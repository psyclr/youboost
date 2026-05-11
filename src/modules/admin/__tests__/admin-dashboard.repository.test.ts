import { createAdminDashboardRepository } from '../admin-dashboard.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    userCount: jest.Mock;
    orderCount: jest.Mock;
    serviceCount: jest.Mock;
    orderAggregate: jest.Mock;
    orderFindMany: jest.Mock;
  };
} {
  const userCount = jest.fn();
  const orderCount = jest.fn();
  const serviceCount = jest.fn();
  const orderAggregate = jest.fn();
  const orderFindMany = jest.fn();
  const prisma = {
    user: { count: userCount },
    order: { count: orderCount, aggregate: orderAggregate, findMany: orderFindMany },
    service: { count: serviceCount },
  } as unknown as PrismaClient;
  return {
    prisma,
    mocks: { userCount, orderCount, serviceCount, orderAggregate, orderFindMany },
  };
}

describe('Admin Dashboard Repository', () => {
  describe('countUsers', () => {
    it('returns total user count', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userCount.mockResolvedValue(42);
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.countUsers();

      expect(result).toBe(42);
      expect(mocks.userCount).toHaveBeenCalledWith();
    });
  });

  describe('countOrders', () => {
    it('returns total order count', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.orderCount.mockResolvedValue(150);
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.countOrders();

      expect(result).toBe(150);
      expect(mocks.orderCount).toHaveBeenCalledWith();
    });
  });

  describe('countActiveServices', () => {
    it('returns count of active services', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.serviceCount.mockResolvedValue(7);
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.countActiveServices();

      expect(result).toBe(7);
      expect(mocks.serviceCount).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });

  describe('sumRevenueByStatuses', () => {
    it('returns summed revenue as number when price sum exists', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.orderAggregate.mockResolvedValue({ _sum: { price: 1234.5 } });
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.sumRevenueByStatuses(['COMPLETED', 'PARTIAL']);

      expect(result).toBe(1234.5);
      expect(mocks.orderAggregate).toHaveBeenCalledWith({
        _sum: { price: true },
        where: { status: { in: ['COMPLETED', 'PARTIAL'] } },
      });
    });

    it('returns 0 when price sum is null', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.orderAggregate.mockResolvedValue({ _sum: { price: null } });
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.sumRevenueByStatuses(['COMPLETED']);

      expect(result).toBe(0);
    });

    it('coerces Decimal-like value to number', async () => {
      const { prisma, mocks } = createFakePrisma();
      // Prisma Decimal exposes a custom toString / [Symbol.toPrimitive].
      // Number() call in repo handles both plain numbers and Decimal objects via valueOf.
      const decimalLike = { valueOf: (): number => 99.99 };
      mocks.orderAggregate.mockResolvedValue({ _sum: { price: decimalLike } });
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.sumRevenueByStatuses(['COMPLETED']);

      expect(result).toBe(99.99);
    });
  });

  describe('findRecentOrders', () => {
    it('returns N most recent orders ordered by createdAt desc', async () => {
      const { prisma, mocks } = createFakePrisma();
      const orders = [
        { id: 'order-2', createdAt: new Date('2024-02-01') },
        { id: 'order-1', createdAt: new Date('2024-01-01') },
      ];
      mocks.orderFindMany.mockResolvedValue(orders);
      const repo = createAdminDashboardRepository(prisma);

      const result = await repo.findRecentOrders(5);

      expect(result).toEqual(orders);
      expect(mocks.orderFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });
});
