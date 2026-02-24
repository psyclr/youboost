import {
  signPayload,
  enqueueWebhookDelivery,
  processWebhookDelivery,
  startWebhookWorker,
  stopWebhookWorker,
} from '../webhook-dispatcher';
import type { Job } from 'bullmq';

const mockFindActiveWebhooksByEvent = jest.fn();
const mockUpdateLastTriggeredAt = jest.fn();
const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();

jest.mock('../webhooks.repository', () => ({
  findActiveWebhooksByEvent: (...args: unknown[]): unknown =>
    mockFindActiveWebhooksByEvent(...args),
  updateLastTriggeredAt: (...args: unknown[]): unknown => mockUpdateLastTriggeredAt(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../../shared/redis/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    duplicate: jest.fn().mockReturnValue({}),
  }),
}));

let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;
const capturedEventHandlers: Record<string, (...args: unknown[]) => void> = {};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: (...args: unknown[]): unknown => mockQueueAdd(...args),
    close: (...args: unknown[]): unknown => mockQueueClose(...args),
  })),
  Worker: jest
    .fn()
    .mockImplementation((_name: string, processor: (job: unknown) => Promise<void>) => {
      capturedProcessor = processor;
      return {
        on: jest.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          capturedEventHandlers[event] = handler;
        }),
        close: (...args: unknown[]): unknown => mockWorkerClose(...args),
      };
    }),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Webhook Dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateLastTriggeredAt.mockResolvedValue(undefined);
    capturedProcessor = null;
    for (const key of Object.keys(capturedEventHandlers)) {
      delete capturedEventHandlers[key];
    }
  });

  afterEach(async () => {
    await stopWebhookWorker();
  });

  describe('signPayload', () => {
    it('should produce HMAC-SHA256 hex signature', () => {
      const sig = signPayload('test-payload', 'secret');
      expect(sig).toHaveLength(64);
      expect(sig).toMatch(/^[a-f0-9]+$/);
    });

    it('should produce consistent signatures', () => {
      const sig1 = signPayload('payload', 'secret');
      const sig2 = signPayload('payload', 'secret');
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const sig1 = signPayload('payload', 'secret1');
      const sig2 = signPayload('payload', 'secret2');
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const sig1 = signPayload('payload1', 'secret');
      const sig2 = signPayload('payload2', 'secret');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('enqueueWebhookDelivery', () => {
    it('should do nothing when no active webhooks', async () => {
      mockFindActiveWebhooksByEvent.mockResolvedValue([]);
      await enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('should enqueue a job for each matching webhook', async () => {
      mockFindActiveWebhooksByEvent.mockResolvedValue([
        { id: 'wh-1', url: 'https://a.com/hook', secret: 's1', events: ['order.created'] },
        { id: 'wh-2', url: 'https://b.com/hook', secret: 's2', events: ['order.created'] },
      ]);
      mockQueueAdd.mockResolvedValue({});
      await enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });
      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    });

    it('should include webhook data in job', async () => {
      mockFindActiveWebhooksByEvent.mockResolvedValue([
        { id: 'wh-1', url: 'https://a.com/hook', secret: 's1', events: ['order.created'] },
      ]);
      mockQueueAdd.mockResolvedValue({});
      await enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'deliver:order.created',
        expect.objectContaining({
          webhookId: 'wh-1',
          url: 'https://a.com/hook',
          event: 'order.created',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should not throw when enqueue fails', async () => {
      mockFindActiveWebhooksByEvent.mockRejectedValue(new Error('DB error'));
      await expect(
        enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('processWebhookDelivery', () => {
    const mockJob = {
      data: {
        webhookId: 'wh-1',
        url: 'https://example.com/hook',
        secret: 'test-secret',
        event: 'order.created',
        payload: { event: 'order.created', data: { orderId: 'o1' } },
      },
    } as unknown as Job<{
      webhookId: string;
      url: string;
      secret: string;
      event: string;
      payload: Record<string, unknown>;
    }>;

    it('should POST to webhook URL with signature', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      await processWebhookDelivery(mockJob);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expect.any(String),
            'X-Webhook-Event': 'order.created',
          }),
        }),
      );
    });

    it('should throw on non-2xx response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
      await expect(processWebhookDelivery(mockJob)).rejects.toThrow('Webhook delivery failed');
    });

    it('should update lastTriggeredAt on success', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      await processWebhookDelivery(mockJob);
      expect(mockUpdateLastTriggeredAt).toHaveBeenCalledWith('wh-1');
    });

    it('should not propagate updateLastTriggeredAt rejection', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockUpdateLastTriggeredAt.mockRejectedValue(new Error('DB error'));
      await expect(processWebhookDelivery(mockJob)).resolves.toBeUndefined();
      // Let fire-and-forget catch handler run
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  describe('startWebhookWorker / stopWebhookWorker', () => {
    it('should start worker without errors', async () => {
      await expect(startWebhookWorker()).resolves.toBeUndefined();
    });

    it('should stop worker without errors', async () => {
      mockWorkerClose.mockResolvedValue(undefined);
      mockQueueClose.mockResolvedValue(undefined);
      await expect(stopWebhookWorker()).resolves.toBeUndefined();
    });

    it('should log warning and return early when worker already started', async () => {
      await startWebhookWorker();
      await expect(startWebhookWorker()).resolves.toBeUndefined();
    });
  });

  describe('worker processor and event handlers', () => {
    it('should invoke processWebhookDelivery via worker processor', async () => {
      await startWebhookWorker();
      expect(capturedProcessor).toBeDefined();

      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      const fakeJob = {
        name: 'deliver:order.created',
        data: {
          webhookId: 'wh-1',
          url: 'https://example.com/hook',
          secret: 'test-secret',
          event: 'order.created',
          payload: { event: 'order.created', data: {} },
        },
      };
      await capturedProcessor!(fakeJob);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/hook', expect.any(Object));
    });

    it('should not throw from failed event handler', async () => {
      await startWebhookWorker();
      const handler = capturedEventHandlers['failed'];
      if (!handler) throw new Error('failed handler not registered');
      expect(() => {
        handler({ name: 'test-job' }, new Error('fail'));
      }).not.toThrow();
    });

    it('should not throw from completed event handler', async () => {
      await startWebhookWorker();
      const handler = capturedEventHandlers['completed'];
      if (!handler) throw new Error('completed handler not registered');
      expect(() => {
        handler({ name: 'test-job' });
      }).not.toThrow();
    });
  });
});
