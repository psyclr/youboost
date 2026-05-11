import { createCouponsRepository } from '../coupons.repository';
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
    coupon: { create, findUnique, findMany, count, update },
  } as unknown as PrismaClient;
  return { prisma, mocks: { create, findUnique, findMany, count, update } };
}

const mockCoupon = {
  id: 'coupon-1',
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  maxUses: 100,
  usedCount: 0,
  minOrderAmount: 5,
  expiresAt: new Date('2030-01-01'),
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Coupons Repository', () => {
  describe('createCoupon', () => {
    it('creates coupon with all optional fields provided', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockCoupon);
      const repo = createCouponsRepository(prisma);

      const result = await repo.createCoupon({
        code: 'SAVE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxUses: 100,
        minOrderAmount: 5,
        expiresAt: new Date('2030-01-01'),
      });

      expect(result).toEqual(mockCoupon);
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          code: 'SAVE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          maxUses: 100,
          minOrderAmount: 5,
          expiresAt: new Date('2030-01-01'),
        },
      });
    });

    it('creates coupon with optional fields defaulting to null', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.create.mockResolvedValue(mockCoupon);
      const repo = createCouponsRepository(prisma);

      await repo.createCoupon({
        code: 'FIXED5',
        discountType: 'FIXED',
        discountValue: 5,
      });

      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          code: 'FIXED5',
          discountType: 'FIXED',
          discountValue: 5,
          maxUses: null,
          minOrderAmount: null,
          expiresAt: null,
        },
      });
    });
  });

  describe('findCouponByCode', () => {
    it('returns coupon when found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(mockCoupon);
      const repo = createCouponsRepository(prisma);

      const result = await repo.findCouponByCode('SAVE10');

      expect(result).toEqual(mockCoupon);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { code: 'SAVE10' } });
    });

    it('returns null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createCouponsRepository(prisma);

      const result = await repo.findCouponByCode('NOPE');

      expect(result).toBeNull();
    });
  });

  describe('findCouponById', () => {
    it('returns coupon when found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(mockCoupon);
      const repo = createCouponsRepository(prisma);

      const result = await repo.findCouponById('coupon-1');

      expect(result).toEqual(mockCoupon);
      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'coupon-1' } });
    });

    it('returns null when not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findUnique.mockResolvedValue(null);
      const repo = createCouponsRepository(prisma);

      const result = await repo.findCouponById('missing');

      expect(result).toBeNull();
    });
  });

  describe('listCoupons', () => {
    it('returns paginated coupons without active filter', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([mockCoupon]);
      mocks.count.mockResolvedValue(1);
      const repo = createCouponsRepository(prisma);

      const result = await repo.listCoupons({ page: 1, limit: 20 });

      expect(result).toEqual({ coupons: [mockCoupon], total: 1 });
      expect(mocks.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(mocks.count).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by isActive=true', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCouponsRepository(prisma);

      await repo.listCoupons({ page: 2, limit: 10, isActive: true });

      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(mocks.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('filters by isActive=false', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.findMany.mockResolvedValue([]);
      mocks.count.mockResolvedValue(0);
      const repo = createCouponsRepository(prisma);

      await repo.listCoupons({ page: 1, limit: 5, isActive: false });

      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { isActive: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 5,
      });
    });
  });

  describe('incrementUsedCount', () => {
    it('increments usedCount by 1', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue(mockCoupon);
      const repo = createCouponsRepository(prisma);

      await repo.incrementUsedCount('coupon-1');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });

  describe('deactivateCoupon', () => {
    it('sets isActive to false', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.update.mockResolvedValue({ ...mockCoupon, isActive: false });
      const repo = createCouponsRepository(prisma);

      await repo.deactivateCoupon('coupon-1');

      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { isActive: false },
      });
    });
  });
});
