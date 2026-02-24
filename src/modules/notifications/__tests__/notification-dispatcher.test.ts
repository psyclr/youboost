import {
  enqueueNotification,
  processNotificationDelivery,
  startNotificationWorker,
  stopNotificationWorker,
} from '../notification-dispatcher';
import type { Job } from 'bullmq';

const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();

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

jest.mock('../../../shared/redis/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    duplicate: jest.fn().mockReturnValue({}),
  }),
}));

const mockFindNotificationById = jest.fn();
const mockUpdateNotificationStatus = jest.fn();
const mockIncrementRetryCount = jest.fn();

jest.mock('../notification.repository', () => ({
  findNotificationById: (...args: unknown[]): unknown => mockFindNotificationById(...args),
  updateNotificationStatus: (...args: unknown[]): unknown => mockUpdateNotificationStatus(...args),
  incrementRetryCount: (...args: unknown[]): unknown => mockIncrementRetryCount(...args),
}));

const mockEmailSend = jest.fn();

jest.mock('../utils/stub-email-provider', () => ({
  emailProvider: {
    send: (...args: unknown[]): unknown => mockEmailSend(...args),
  },
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'EMAIL',
  channel: 'test@test.com',
  subject: 'Test Subject',
  body: 'Test body',
  status: 'PENDING',
  eventType: 'order.created',
  referenceType: 'order',
  referenceId: 'order-1',
  sentAt: null,
  failureReason: null,
  retryCount: 0,
  createdAt: new Date(),
};

describe('Notification Dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue({});
    mockQueueClose.mockResolvedValue(undefined);
    mockWorkerClose.mockResolvedValue(undefined);
    capturedProcessor = null;
    for (const key of Object.keys(capturedEventHandlers)) {
      delete capturedEventHandlers[key];
    }
  });

  afterEach(async () => {
    await stopNotificationWorker();
  });

  describe('enqueueNotification', () => {
    it('should add job to queue', async () => {
      await enqueueNotification('notif-1');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'deliver-notification',
        { notificationId: 'notif-1' },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        }),
      );
    });

    it('should not throw when queue.add fails', async () => {
      mockQueueAdd.mockRejectedValue(new Error('Redis down'));

      await expect(enqueueNotification('notif-1')).resolves.toBeUndefined();
    });
  });

  describe('processNotificationDelivery', () => {
    const createJob = (notificationId: string): Job =>
      ({
        data: { notificationId },
      }) as unknown as Job;

    it('should send email and update status to SENT', async () => {
      mockFindNotificationById.mockResolvedValue(mockNotification);
      mockEmailSend.mockResolvedValue(undefined);
      mockUpdateNotificationStatus.mockResolvedValue({
        ...mockNotification,
        status: 'SENT',
      });

      await processNotificationDelivery(createJob('notif-1'));

      expect(mockEmailSend).toHaveBeenCalledWith({
        to: 'test@test.com',
        subject: 'Test Subject',
        body: 'Test body',
      });
      expect(mockUpdateNotificationStatus).toHaveBeenCalledWith('notif-1', 'SENT');
    });

    it('should skip if notification not found', async () => {
      mockFindNotificationById.mockResolvedValue(null);

      await processNotificationDelivery(createJob('notif-999'));

      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('should skip if notification status is not PENDING', async () => {
      mockFindNotificationById.mockResolvedValue({ ...mockNotification, status: 'SENT' });

      await processNotificationDelivery(createJob('notif-1'));

      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('should increment retry and set FAILED on send error', async () => {
      mockFindNotificationById.mockResolvedValue(mockNotification);
      mockEmailSend.mockRejectedValue(new Error('SMTP error'));
      mockIncrementRetryCount.mockResolvedValue({ ...mockNotification, retryCount: 1 });
      mockUpdateNotificationStatus.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });

      await expect(processNotificationDelivery(createJob('notif-1'))).rejects.toThrow('SMTP error');

      expect(mockIncrementRetryCount).toHaveBeenCalledWith('notif-1');
      expect(mockUpdateNotificationStatus).toHaveBeenCalledWith('notif-1', 'FAILED', 'SMTP error');
    });

    it('should use empty string for subject when null', async () => {
      mockFindNotificationById.mockResolvedValue({ ...mockNotification, subject: null });
      mockEmailSend.mockResolvedValue(undefined);
      mockUpdateNotificationStatus.mockResolvedValue(mockNotification);

      await processNotificationDelivery(createJob('notif-1'));

      expect(mockEmailSend).toHaveBeenCalledWith(expect.objectContaining({ subject: '' }));
    });
  });

  describe('startNotificationWorker', () => {
    it('should start worker without error', async () => {
      await expect(startNotificationWorker()).resolves.toBeUndefined();
    });

    it('should not start worker twice', async () => {
      await startNotificationWorker();
      // second call should warn and return
      await expect(startNotificationWorker()).resolves.toBeUndefined();
    });
  });

  describe('stopNotificationWorker', () => {
    it('should stop worker and queue', async () => {
      await startNotificationWorker();
      await expect(stopNotificationWorker()).resolves.toBeUndefined();
    });

    it('should handle stop when not started', async () => {
      await expect(stopNotificationWorker()).resolves.toBeUndefined();
    });
  });

  describe('worker processor and event handlers', () => {
    it('should invoke processNotificationDelivery via worker processor', async () => {
      await startNotificationWorker();
      expect(capturedProcessor).toBeDefined();

      mockFindNotificationById.mockResolvedValue(mockNotification);
      mockEmailSend.mockResolvedValue(undefined);
      mockUpdateNotificationStatus.mockResolvedValue({ ...mockNotification, status: 'SENT' });

      const fakeJob = {
        name: 'deliver-notification',
        data: { notificationId: 'notif-1' },
      };
      await capturedProcessor!(fakeJob);
      expect(mockEmailSend).toHaveBeenCalledWith({
        to: 'test@test.com',
        subject: 'Test Subject',
        body: 'Test body',
      });
    });

    it('should not throw from failed event handler', async () => {
      await startNotificationWorker();
      const handler = capturedEventHandlers['failed'];
      if (!handler) throw new Error('failed handler not registered');
      expect(() => {
        handler({ name: 'test-job' }, new Error('fail'));
      }).not.toThrow();
    });

    it('should not throw from completed event handler', async () => {
      await startNotificationWorker();
      const handler = capturedEventHandlers['completed'];
      if (!handler) throw new Error('completed handler not registered');
      expect(() => {
        handler({ name: 'test-job' });
      }).not.toThrow();
    });
  });
});
