import { createNotificationsService } from '../notifications.service';
import { createFakeNotificationRepository, createFakeEnqueue, silentLogger } from './fakes';
import type { NotificationRecord } from '../notifications.types';

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-seed',
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

describe('Notifications Service', () => {
  describe('sendNotification', () => {
    it('should create notification and enqueue', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test Subject',
        body: 'Test body',
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: 'order-1',
      });

      expect(result.id).toBe('notif-1');
      expect(notificationRepo.calls.createNotification).toHaveLength(1);
      expect(notificationRepo.calls.createNotification[0]).toMatchObject({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        eventType: 'order.created',
      });
      expect(enqueue.ids).toEqual(['notif-1']);
    });

    it('should pass null for optional fields when not provided', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      await service.sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(notificationRepo.calls.createNotification[0]).toMatchObject({
        eventType: null,
        referenceType: null,
        referenceId: null,
      });
    });

    it('should return the created notification record', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.status).toBe('PENDING');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('listNotifications', () => {
    it('should return paginated notifications', async () => {
      const record = makeRecord({ id: 'notif-seed-1' });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass status filter', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      await service.listNotifications('user-1', { page: 1, limit: 20, status: 'SENT' });

      expect(notificationRepo.calls.findNotificationsByUserId).toEqual([
        { userId: 'user-1', filters: { status: 'SENT', page: 1, limit: 20 } },
      ]);
    });

    it('should calculate totalPages correctly', async () => {
      const records = Array.from({ length: 45 }, (_, i) => makeRecord({ id: `notif-seed-${i}` }));
      const notificationRepo = createFakeNotificationRepository({ notifications: records });
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.total).toBe(45);
    });

    it('should return empty array when no notifications', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should map notification fields correctly', async () => {
      const record = makeRecord({ id: 'notif-seed-1' });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications[0]).toEqual(
        expect.objectContaining({
          id: 'notif-seed-1',
          type: 'EMAIL',
          channel: 'test@test.com',
          subject: 'Test Subject',
          status: 'PENDING',
          eventType: 'order.created',
        }),
      );
    });
  });

  describe('getNotification', () => {
    it('should return notification by id and userId', async () => {
      const record = makeRecord({ id: 'notif-seed-1' });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.getNotification('notif-seed-1', 'user-1');

      expect(result.id).toBe('notif-seed-1');
      expect(notificationRepo.calls.findNotificationById).toEqual([
        { id: 'notif-seed-1', userId: 'user-1' },
      ]);
    });

    it('should throw NotFoundError when not found', async () => {
      const notificationRepo = createFakeNotificationRepository();
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      await expect(service.getNotification('notif-999', 'user-1')).rejects.toThrow(
        'Notification not found',
      );
    });

    it('should return full notification record', async () => {
      const record = makeRecord({ id: 'notif-seed-1' });
      const notificationRepo = createFakeNotificationRepository({ notifications: [record] });
      const enqueue = createFakeEnqueue();
      const service = createNotificationsService({
        notificationRepo,
        enqueueNotificationJob: enqueue.fn,
        logger: silentLogger,
      });

      const result = await service.getNotification('notif-seed-1', 'user-1');

      expect(result.body).toBe('Test body');
      expect(result.retryCount).toBe(0);
    });
  });
});
