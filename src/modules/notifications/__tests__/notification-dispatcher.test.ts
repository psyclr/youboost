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

import { createNotificationDispatcher } from '../notification-dispatcher';
import { createFakeNotificationRepository, createFakeEmailProvider, silentLogger } from './fakes';
import type { NotificationRecord } from '../notifications.types';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const createJob = (notificationId: string): Job =>
  ({
    data: { notificationId },
  }) as unknown as Job;

describe('Notification Dispatcher', () => {
  beforeEach(() => {
    mockStartNamedWorker.mockClear();
    mockStopNamedWorker.mockClear();
    mockQueueAdd.mockClear();
    mockGetNamedQueue.mockClear();
    mockQueueAdd.mockResolvedValue({});
    mockGetNamedQueue.mockReturnValue({ add: mockQueueAdd });
  });

  describe('enqueueNotification', () => {
    it('should add job to queue', async () => {
      const dispatcher = createNotificationDispatcher({
        notificationRepo: createFakeNotificationRepository(),
        emailProvider: createFakeEmailProvider(),
        logger: silentLogger,
      });

      await dispatcher.enqueueNotification('notif-1');

      expect(mockGetNamedQueue).toHaveBeenCalledWith('notification-delivery');
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
      mockQueueAdd.mockRejectedValueOnce(new Error('Redis down'));
      const dispatcher = createNotificationDispatcher({
        notificationRepo: createFakeNotificationRepository(),
        emailProvider: createFakeEmailProvider(),
        logger: silentLogger,
      });

      await expect(dispatcher.enqueueNotification('notif-1')).resolves.toBeUndefined();
    });
  });

  describe('worker processor (via start)', () => {
    it('should send email and update status to SENT', async () => {
      const record = makeRecord();
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const emailProvider = createFakeEmailProvider();
      const dispatcher = createNotificationDispatcher({
        notificationRepo,
        emailProvider,
        logger: silentLogger,
      });

      await dispatcher.start();
      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'notification-delivery',
        expect.any(Function),
        expect.objectContaining({ retryable: true, concurrency: 3 }),
      );
      const processor = mockStartNamedWorker.mock.calls[0][1] as (job: Job) => Promise<void>;

      await processor(createJob('notif-1'));

      expect(emailProvider.sent).toEqual([
        { to: 'test@test.com', subject: 'Test Subject', body: 'Test body' },
      ]);
      const lastUpdate =
        notificationRepo.calls.updateNotificationStatus[
          notificationRepo.calls.updateNotificationStatus.length - 1
        ];
      expect(lastUpdate).toMatchObject({ id: 'notif-1', status: 'SENT' });
    });

    it('should skip if notification not found', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const emailProvider = createFakeEmailProvider();
      const dispatcher = createNotificationDispatcher({
        notificationRepo,
        emailProvider,
        logger: silentLogger,
      });

      await dispatcher.start();
      const processor = mockStartNamedWorker.mock.calls[0][1] as (job: Job) => Promise<void>;

      await processor(createJob('notif-999'));

      expect(emailProvider.sent).toHaveLength(0);
    });

    it('should skip if notification status is not PENDING', async () => {
      const record = makeRecord({ status: 'SENT' });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const emailProvider = createFakeEmailProvider();
      const dispatcher = createNotificationDispatcher({
        notificationRepo,
        emailProvider,
        logger: silentLogger,
      });

      await dispatcher.start();
      const processor = mockStartNamedWorker.mock.calls[0][1] as (job: Job) => Promise<void>;

      await processor(createJob('notif-1'));

      expect(emailProvider.sent).toHaveLength(0);
    });

    it('should increment retry and set FAILED on send error', async () => {
      const record = makeRecord();
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const emailProvider = createFakeEmailProvider();
      emailProvider.setFailure(new Error('SMTP error'));
      const dispatcher = createNotificationDispatcher({
        notificationRepo,
        emailProvider,
        logger: silentLogger,
      });

      await dispatcher.start();
      const processor = mockStartNamedWorker.mock.calls[0][1] as (job: Job) => Promise<void>;

      await expect(processor(createJob('notif-1'))).rejects.toThrow('SMTP error');

      expect(notificationRepo.calls.incrementRetryCount).toEqual(['notif-1']);
      const lastUpdate =
        notificationRepo.calls.updateNotificationStatus[
          notificationRepo.calls.updateNotificationStatus.length - 1
        ];
      expect(lastUpdate).toMatchObject({
        id: 'notif-1',
        status: 'FAILED',
        failureReason: 'SMTP error',
      });
    });

    it('should use empty string for subject when null', async () => {
      const record = makeRecord({ subject: null });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const emailProvider = createFakeEmailProvider();
      const dispatcher = createNotificationDispatcher({
        notificationRepo,
        emailProvider,
        logger: silentLogger,
      });

      await dispatcher.start();
      const processor = mockStartNamedWorker.mock.calls[0][1] as (job: Job) => Promise<void>;

      await processor(createJob('notif-1'));

      expect(emailProvider.sent[0]).toMatchObject({ subject: '' });
    });
  });

  describe('start', () => {
    it('should start worker without error', async () => {
      const dispatcher = createNotificationDispatcher({
        notificationRepo: createFakeNotificationRepository(),
        emailProvider: createFakeEmailProvider(),
        logger: silentLogger,
      });

      await expect(dispatcher.start()).resolves.toBeUndefined();
      expect(mockStartNamedWorker).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop worker', async () => {
      const dispatcher = createNotificationDispatcher({
        notificationRepo: createFakeNotificationRepository(),
        emailProvider: createFakeEmailProvider(),
        logger: silentLogger,
      });

      await dispatcher.start();
      await expect(dispatcher.stop()).resolves.toBeUndefined();
      expect(mockStopNamedWorker).toHaveBeenCalledWith('notification-delivery');
    });

    it('should handle stop when not started', async () => {
      const dispatcher = createNotificationDispatcher({
        notificationRepo: createFakeNotificationRepository(),
        emailProvider: createFakeEmailProvider(),
        logger: silentLogger,
      });

      await expect(dispatcher.stop()).resolves.toBeUndefined();
    });
  });
});
