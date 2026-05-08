import type { Job } from 'bullmq';

const mockStartNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockStopNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockQueueAdd = jest.fn().mockResolvedValue({});
const mockGetNamedQueue = jest.fn().mockReturnValue({ add: mockQueueAdd });

jest.mock('../../../shared/queue', () => ({
  startNamedWorker: (...args: unknown[]): unknown => mockStartNamedWorker(...args),
  stopNamedWorker: (...args: unknown[]): unknown => mockStopNamedWorker(...args),
  getNamedQueue: (...args: unknown[]): unknown => mockGetNamedQueue(...args),
}));

import { createWebhookDispatcher, signPayload } from '../webhook-dispatcher';
import type { WebhookJobData } from '../webhook-dispatcher';
import { createFakeWebhooksRepository, silentLogger } from './fakes';
import type { WebhookRecord } from '../webhooks.types';

function makeRecord(overrides: Partial<WebhookRecord> = {}): WebhookRecord {
  return {
    id: 'wh-1',
    userId: 'user-1',
    url: 'https://example.com/hook',
    events: ['order.created'],
    secret: 'test-secret',
    isActive: true,
    lastTriggeredAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const createJob = (data: WebhookJobData): Job<WebhookJobData> =>
  ({ data }) as unknown as Job<WebhookJobData>;

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Webhook Dispatcher', () => {
  beforeEach(() => {
    mockStartNamedWorker.mockClear();
    mockStopNamedWorker.mockClear();
    mockQueueAdd.mockClear();
    mockGetNamedQueue.mockClear();
    mockQueueAdd.mockResolvedValue({});
    mockGetNamedQueue.mockReturnValue({ add: mockQueueAdd });
    mockFetch.mockReset();
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
      const webhooksRepo = createFakeWebhooksRepository();
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await dispatcher.enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('should enqueue a job for each matching webhook', async () => {
      const webhooksRepo = createFakeWebhooksRepository({
        webhooks: [
          makeRecord({ id: 'wh-1', url: 'https://a.com/hook', secret: 's1' }),
          makeRecord({ id: 'wh-2', url: 'https://b.com/hook', secret: 's2' }),
        ],
      });
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await dispatcher.enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });

      expect(mockGetNamedQueue).toHaveBeenCalledWith('webhook-delivery');
      expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    });

    it('should include webhook data in job', async () => {
      const webhooksRepo = createFakeWebhooksRepository({
        webhooks: [makeRecord({ id: 'wh-1', url: 'https://a.com/hook', secret: 's1' })],
      });
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await dispatcher.enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' });

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
      const webhooksRepo = createFakeWebhooksRepository();
      webhooksRepo.setFindActiveWebhooksByEventFailure(new Error('DB error'));
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await expect(
        dispatcher.enqueueWebhookDelivery('user-1', 'order.created', { orderId: 'o1' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('processWebhookDelivery', () => {
    const jobData: WebhookJobData = {
      webhookId: 'wh-1',
      url: 'https://example.com/hook',
      secret: 'test-secret',
      event: 'order.created',
      payload: { event: 'order.created', data: { orderId: 'o1' } },
    };

    it('should POST to webhook URL with signature', async () => {
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [makeRecord()] });
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await dispatcher.processWebhookDelivery(createJob(jobData));

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
      const webhooksRepo = createFakeWebhooksRepository();
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      await expect(dispatcher.processWebhookDelivery(createJob(jobData))).rejects.toThrow(
        'Webhook delivery failed',
      );
    });

    it('should update lastTriggeredAt on success', async () => {
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [makeRecord()] });
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await dispatcher.processWebhookDelivery(createJob(jobData));
      // Fire-and-forget; yield once to let microtasks drain.
      await new Promise((r) => setTimeout(r, 0));

      expect(webhooksRepo.calls.updateLastTriggeredAt).toEqual(['wh-1']);
    });

    it('should not propagate updateLastTriggeredAt rejection', async () => {
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [makeRecord()] });
      webhooksRepo.setUpdateLastTriggeredAtFailure(new Error('DB error'));
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await expect(dispatcher.processWebhookDelivery(createJob(jobData))).resolves.toBeUndefined();
      // Let fire-and-forget catch handler run
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  describe('start / stop', () => {
    it('should start worker without errors', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await expect(dispatcher.start()).resolves.toBeUndefined();
      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'webhook-delivery',
        expect.any(Function),
        expect.objectContaining({ retryable: true, concurrency: 3 }),
      );
    });

    it('should stop worker without errors', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });

      await dispatcher.start();
      await expect(dispatcher.stop()).resolves.toBeUndefined();
      expect(mockStopNamedWorker).toHaveBeenCalledWith('webhook-delivery');
    });

    it('should invoke processWebhookDelivery via worker processor', async () => {
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [makeRecord()] });
      const dispatcher = createWebhookDispatcher({ webhooksRepo, logger: silentLogger });
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await dispatcher.start();
      const processor = mockStartNamedWorker.mock.calls[0]?.[1] as (
        job: Job<WebhookJobData>,
      ) => Promise<void>;

      await processor(
        createJob({
          webhookId: 'wh-1',
          url: 'https://example.com/hook',
          secret: 'test-secret',
          event: 'order.created',
          payload: { event: 'order.created', data: {} },
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/hook', expect.any(Object));
    });
  });
});
