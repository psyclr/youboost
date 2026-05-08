import { createProvidersRepository } from '../providers.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
} {
  const create = jest.fn();
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const update = jest.fn();
  const prisma = {
    provider: { create, findUnique, findMany, count, update },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { create, findUnique, findMany, count, update } };
}

const mockProvider = {
  id: 'prov-1',
  name: 'Test Provider',
  apiEndpoint: 'https://api.test.com/v2',
  apiKeyEncrypted: 'iv:tag:encrypted',
  isActive: true,
  priority: 10,
  balance: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Providers Repository', () => {
  describe('createProvider', () => {
    it('should create a provider', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockProvider);
      const repo = createProvidersRepository(prisma);

      const result = await repo.createProvider({
        name: 'Test Provider',
        apiEndpoint: 'https://api.test.com/v2',
        apiKeyEncrypted: 'iv:tag:encrypted',
        priority: 10,
      });

      expect(result).toEqual(mockProvider);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Provider',
          apiEndpoint: 'https://api.test.com/v2',
          apiKeyEncrypted: 'iv:tag:encrypted',
          priority: 10,
        }),
      });
    });

    it('should create with metadata', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue({ ...mockProvider, metadata: { region: 'us' } });
      const repo = createProvidersRepository(prisma);

      await repo.createProvider({
        name: 'Provider',
        apiEndpoint: 'https://api.test.com',
        apiKeyEncrypted: 'encrypted',
        priority: 0,
        metadata: { region: 'us' },
      });

      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { region: 'us' },
        }),
      });
    });
  });

  describe('findProviderById', () => {
    it('should find provider by id', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(mockProvider);
      const repo = createProvidersRepository(prisma);

      const result = await repo.findProviderById('prov-1');

      expect(result).toEqual(mockProvider);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'prov-1' } });
    });

    it('should return null if not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createProvidersRepository(prisma);

      const result = await repo.findProviderById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findProviders', () => {
    it('should return providers with pagination', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockProvider]);
      mocks.count.mockResolvedValue(1);
      const repo = createProvidersRepository(prisma);

      const result = await repo.findProviders({ page: 1, limit: 20 });

      expect(result.providers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createProvidersRepository(prisma);

      await repo.findProviders({ page: 1, limit: 20, isActive: true });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should skip based on page', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createProvidersRepository(prisma);

      await repo.findProviders({ page: 3, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should not include isActive in where if undefined', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createProvidersRepository(prisma);

      await repo.findProviders({ page: 1, limit: 20 });

      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('findActiveProvidersByPriority', () => {
    it('should return active providers sorted by priority desc', async () => {
      const { prisma, mocks } = createFakePrisma();
      const providers = [
        { ...mockProvider, priority: 20 },
        { ...mockProvider, id: 'prov-2', priority: 10 },
      ];
      mocks.findMany.mockResolvedValue(providers);
      const repo = createProvidersRepository(prisma);

      const result = await repo.findActiveProvidersByPriority();

      expect(result).toHaveLength(2);
      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });
    });

    it('should return empty array when no active providers', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      const repo = createProvidersRepository(prisma);

      const result = await repo.findActiveProvidersByPriority();

      expect(result).toHaveLength(0);
    });
  });

  describe('updateProvider', () => {
    it('should update provider name', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockProvider, name: 'Updated' });
      const repo = createProvidersRepository(prisma);

      const result = await repo.updateProvider('prov-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { name: 'Updated' },
      });
    });

    it('should update multiple fields', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockProvider, priority: 99, isActive: false });
      const repo = createProvidersRepository(prisma);

      await repo.updateProvider('prov-1', { priority: 99, isActive: false });

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { priority: 99, isActive: false },
      });
    });

    it('should update apiKeyEncrypted', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockProvider, apiKeyEncrypted: 'new-encrypted' });
      const repo = createProvidersRepository(prisma);

      await repo.updateProvider('prov-1', { apiKeyEncrypted: 'new-encrypted' });

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { apiKeyEncrypted: 'new-encrypted' },
      });
    });

    it('should not include undefined fields in update', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue(mockProvider);
      const repo = createProvidersRepository(prisma);

      await repo.updateProvider('prov-1', { name: 'Only Name' });

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'prov-1' },
        data: { name: 'Only Name' },
      });
    });
  });
});
