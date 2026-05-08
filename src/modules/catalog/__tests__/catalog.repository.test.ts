import { createCatalogRepository } from '../catalog.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
} {
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const prisma = {
    service: { findMany, count, findFirst },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, mocks: { findMany, count, findFirst } };
}

const mockService = {
  id: 'svc-1',
  name: 'YouTube Views',
  description: 'High quality views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: { toNumber: (): number => 5.0 },
  minQuantity: 100,
  maxQuantity: 100000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Catalog Repository', () => {
  describe('findActiveServices', () => {
    it('returns services with pagination', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockService]);
      mocks.count.mockResolvedValue(1);
      const repo = createCatalogRepository(prisma);

      const result = await repo.findActiveServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(mocks.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('filters by platform', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCatalogRepository(prisma);

      await repo.findActiveServices({ platform: 'YOUTUBE', page: 1, limit: 20 });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, platform: 'YOUTUBE' } }),
      );
      expect(mocks.count).toHaveBeenCalledWith({
        where: { isActive: true, platform: 'YOUTUBE' },
      });
    });

    it('filters by type', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCatalogRepository(prisma);

      await repo.findActiveServices({ type: 'VIEWS', page: 1, limit: 20 });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, type: 'VIEWS' } }),
      );
    });

    it('filters by both platform and type', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCatalogRepository(prisma);

      await repo.findActiveServices({ platform: 'INSTAGRAM', type: 'LIKES', page: 1, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, platform: 'INSTAGRAM', type: 'LIKES' },
        }),
      );
    });

    it('calculates skip based on page', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCatalogRepository(prisma);

      await repo.findActiveServices({ page: 3, limit: 10 });

      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('returns empty array when no services found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCatalogRepository(prisma);

      const result = await repo.findActiveServices({ page: 1, limit: 20 });

      expect(result.services).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findActiveServiceById', () => {
    it('returns active service by id', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(mockService);
      const repo = createCatalogRepository(prisma);

      const result = await repo.findActiveServiceById('svc-1');

      expect(result).toEqual(mockService);
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: 'svc-1', isActive: true },
      });
    });

    it('returns null if service not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createCatalogRepository(prisma);

      const result = await repo.findActiveServiceById('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null if service is inactive', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findFirst.mockResolvedValue(null);
      const repo = createCatalogRepository(prisma);

      const result = await repo.findActiveServiceById('svc-inactive');

      expect(result).toBeNull();
      expect(mocks.findFirst).toHaveBeenCalledWith({
        where: { id: 'svc-inactive', isActive: true },
      });
    });
  });
});
