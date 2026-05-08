import { createWebhooksRepository } from '../webhooks.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
} {
  const create = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const update = jest.fn();
  const del = jest.fn();
  const prisma = {
    webhook: { create, findMany, count, findFirst, update, delete: del },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { create, findMany, count, findFirst, update, delete: del } };
}

const mockRecord = {
  id: 'wh-1',
  userId: 'user-1',
  url: 'https://example.com/hook',
  events: ['order.created'],
  secret: 'secret123',
  isActive: true,
  lastTriggeredAt: null,
  createdAt: new Date(),
};

describe('Webhooks Repository', () => {
  describe('createWebhook', () => {
    it('should create a webhook', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockRecord);
      const repo = createWebhooksRepository(prisma);

      const result = await repo.createWebhook({
        userId: 'user-1',
        url: 'https://example.com/hook',
        events: ['order.created'],
        secret: 'secret123',
      });

      expect(result).toEqual(mockRecord);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          url: 'https://example.com/hook',
        }),
      });
    });
  });

  describe('findWebhooksByUserId', () => {
    it('should return paginated results', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockRecord]);
      mocks.count.mockResolvedValue(1);
      const repo = createWebhooksRepository(prisma);

      const result = await repo.findWebhooksByUserId('user-1', { page: 1, limit: 20 });

      expect(result.webhooks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createWebhooksRepository(prisma);

      await repo.findWebhooksByUserId('user-1', { page: 1, limit: 20, isActive: true });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
      );
    });

    it('should apply pagination offset', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createWebhooksRepository(prisma);

      await repo.findWebhooksByUserId('user-1', { page: 3, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('findWebhookById', () => {
    it('should find webhook scoped by userId', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockRecord);
      const repo = createWebhooksRepository(prisma);

      const result = await repo.findWebhookById('wh-1', 'user-1');

      expect(result).toEqual(mockRecord);
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createWebhooksRepository(prisma);

      const result = await repo.findWebhookById('bad', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook fields', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockRecord);
      mocks.update.mockResolvedValue({ ...mockRecord, url: 'https://new.com' });
      const repo = createWebhooksRepository(prisma);

      const result = await repo.updateWebhook('wh-1', 'user-1', { url: 'https://new.com' });

      expect(result.url).toBe('https://new.com');
    });

    it('should throw when webhook not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createWebhooksRepository(prisma);

      await expect(repo.updateWebhook('bad', 'user-1', { url: 'https://x.com' })).rejects.toThrow();
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockRecord);
      mocks.delete.mockResolvedValue(mockRecord);
      const repo = createWebhooksRepository(prisma);

      await repo.deleteWebhook('wh-1', 'user-1');

      expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
    });

    it('should throw when webhook not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createWebhooksRepository(prisma);

      await expect(repo.deleteWebhook('bad', 'user-1')).rejects.toThrow();
    });
  });

  describe('findActiveWebhooksByEvent', () => {
    it('should find active webhooks matching event', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockRecord]);
      const repo = createWebhooksRepository(prisma);

      const result = await repo.findActiveWebhooksByEvent('user-1', 'order.created');

      expect(result).toHaveLength(1);
      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true, events: { has: 'order.created' } },
      });
    });
  });

  describe('updateLastTriggeredAt', () => {
    it('should update lastTriggeredAt timestamp', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue(mockRecord);
      const repo = createWebhooksRepository(prisma);

      await repo.updateLastTriggeredAt('wh-1');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });
  });
});
