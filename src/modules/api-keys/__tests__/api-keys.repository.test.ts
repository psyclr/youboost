import { createApiKeysRepository } from '../api-keys.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
} {
  const create = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const update = jest.fn();
  const prisma = {
    apiKey: { create, findMany, count, findUnique, updateMany, update },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { create, findMany, count, findUnique, updateMany, update } };
}

const mockRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: 'hash123',
  name: 'Test Key',
  permissions: null,
  rateLimitTier: 'BASIC',
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
};

describe('API Keys Repository', () => {
  describe('createApiKey', () => {
    it('should create an API key', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockRecord);
      const repo = createApiKeysRepository(prisma);

      const result = await repo.createApiKey({
        userId: 'user-1',
        name: 'Test Key',
        keyHash: 'hash123',
        rateLimitTier: 'BASIC',
      });

      expect(result).toEqual(mockRecord);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', name: 'Test Key', keyHash: 'hash123' }),
      });
    });

    it('should include permissions when provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockRecord);
      const repo = createApiKeysRepository(prisma);

      await repo.createApiKey({
        userId: 'user-1',
        name: 'Key',
        keyHash: 'hash',
        rateLimitTier: 'PRO',
        permissions: { read: true },
      });

      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ permissions: { read: true } }),
      });
    });

    it('should include expiresAt when provided', async () => {
      const expiresAt = new Date('2027-01-01');
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockRecord);
      const repo = createApiKeysRepository(prisma);

      await repo.createApiKey({
        userId: 'user-1',
        name: 'Key',
        keyHash: 'hash',
        rateLimitTier: 'BASIC',
        expiresAt,
      });

      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ expiresAt }),
      });
    });
  });

  describe('findApiKeysByUserId', () => {
    it('should return paginated results', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockRecord]);
      mocks.count.mockResolvedValue(1);
      const repo = createApiKeysRepository(prisma);

      const result = await repo.findApiKeysByUserId('user-1', { page: 1, limit: 20 });

      expect(result.apiKeys).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createApiKeysRepository(prisma);

      await repo.findApiKeysByUserId('user-1', { page: 1, limit: 20, isActive: true });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
      );
    });

    it('should apply correct pagination offset', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createApiKeysRepository(prisma);

      await repo.findApiKeysByUserId('user-1', { page: 3, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('findApiKeyByHash', () => {
    it('should find key by hash with user relation', async () => {
      const withUser = { ...mockRecord, user: { role: 'USER', email: 'a@b.com' } };
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(withUser);
      const repo = createApiKeysRepository(prisma);

      const result = await repo.findApiKeyByHash('hash123');

      expect(result).toEqual(withUser);
      expect(mocks.findUnique).toHaveBeenCalledWith({
        where: { keyHash: 'hash123' },
        include: { user: { select: { role: true, email: true } } },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createApiKeysRepository(prisma);

      const result = await repo.findApiKeyByHash('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteApiKey', () => {
    it('should soft-delete by setting isActive to false', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.updateMany.mockResolvedValue({ count: 1 });
      const repo = createApiKeysRepository(prisma);

      await repo.deleteApiKey('key-1', 'user-1');

      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { id: 'key-1', userId: 'user-1' },
        data: { isActive: false },
      });
    });
  });

  describe('updateLastUsedAt', () => {
    it('should update lastUsedAt timestamp', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue(mockRecord);
      const repo = createApiKeysRepository(prisma);

      await repo.updateLastUsedAt('key-1');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});
