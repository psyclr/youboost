import { createNotificationRepository } from '../notification.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
} {
  const create = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const update = jest.fn();
  const prisma = {
    notification: { create, findMany, count, findFirst, update },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { create, findMany, count, findFirst, update } };
}

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'EMAIL',
  channel: 'test@test.com',
  subject: 'Test',
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

describe('Notification Repository', () => {
  describe('createNotification', () => {
    it('should create notification with PENDING status', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockNotification);
      const repo = createNotificationRepository(prisma);

      const result = await repo.createNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: 'order-1',
      });

      expect(result.id).toBe('notif-1');
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'EMAIL',
          status: 'PENDING',
        }),
      });
    });

    it('should set null for optional fields when not provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockNotification);
      const repo = createNotificationRepository(prisma);

      await repo.createNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
      });

      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: null,
          referenceType: null,
          referenceId: null,
        }),
      });
    });
  });

  describe('findNotificationsByUserId', () => {
    it('should return paginated notifications', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockNotification]);
      mocks.count.mockResolvedValue(1);
      const repo = createNotificationRepository(prisma);

      const result = await repo.findNotificationsByUserId('user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createNotificationRepository(prisma);

      await repo.findNotificationsByUserId('user-1', {
        status: 'SENT',
        page: 1,
        limit: 20,
      });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'SENT' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createNotificationRepository(prisma);

      await repo.findNotificationsByUserId('user-1', { page: 3, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createNotificationRepository(prisma);

      await repo.findNotificationsByUserId('user-1', { page: 1, limit: 20 });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findNotificationById', () => {
    it('should return notification by id', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockNotification);
      const repo = createNotificationRepository(prisma);

      const result = await repo.findNotificationById('notif-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-1');
    });

    it('should filter by userId when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockNotification);
      const repo = createNotificationRepository(prisma);

      await repo.findNotificationById('notif-1', 'user-1');

      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createNotificationRepository(prisma);

      const result = await repo.findNotificationById('notif-999');

      expect(result).toBeNull();
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update status to SENT and set sentAt', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockNotification, status: 'SENT', sentAt: new Date() });
      const repo = createNotificationRepository(prisma);

      await repo.updateNotificationStatus('notif-1', 'SENT');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should update status to FAILED with reason', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockNotification, status: 'FAILED' });
      const repo = createNotificationRepository(prisma);

      await repo.updateNotificationStatus('notif-1', 'FAILED', 'Connection refused');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: 'Connection refused',
        }),
      });
    });

    it('should not set sentAt for FAILED status', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockNotification, status: 'FAILED' });
      const repo = createNotificationRepository(prisma);

      await repo.updateNotificationStatus('notif-1', 'FAILED');

      const callData = mocks.update.mock.calls[0][0].data;
      expect(callData.sentAt).toBeUndefined();
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockNotification, retryCount: 1 });
      const repo = createNotificationRepository(prisma);

      const result = await repo.incrementRetryCount('notif-1');

      expect(result.retryCount).toBe(1);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { retryCount: { increment: 1 } },
      });
    });
  });
});
