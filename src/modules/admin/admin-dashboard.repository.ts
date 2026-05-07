import { getPrisma } from '../../shared/database';
import type { OrderStatus, PrismaClient } from '../../generated/prisma';
import type { OrderRecord } from '../orders';

export interface AdminDashboardRepository {
  countUsers(): Promise<number>;
  countOrders(): Promise<number>;
  countActiveServices(): Promise<number>;
  sumRevenueByStatuses(statuses: OrderStatus[]): Promise<number>;
  findRecentOrders(limit: number): Promise<OrderRecord[]>;
}

export function createAdminDashboardRepository(prisma: PrismaClient): AdminDashboardRepository {
  async function countUsers(): Promise<number> {
    return prisma.user.count();
  }

  async function countOrders(): Promise<number> {
    return prisma.order.count();
  }

  async function countActiveServices(): Promise<number> {
    return prisma.service.count({ where: { isActive: true } });
  }

  async function sumRevenueByStatuses(statuses: OrderStatus[]): Promise<number> {
    const result = await prisma.order.aggregate({
      _sum: { price: true },
      where: { status: { in: statuses } },
    });
    return result._sum.price ? Number(result._sum.price) : 0;
  }

  async function findRecentOrders(limit: number): Promise<OrderRecord[]> {
    return prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  return {
    countUsers,
    countOrders,
    countActiveServices,
    sumRevenueByStatuses,
    findRecentOrders,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function countUsers(): Promise<number> {
  return createAdminDashboardRepository(getPrisma()).countUsers();
}

export async function countOrders(): Promise<number> {
  return createAdminDashboardRepository(getPrisma()).countOrders();
}

export async function countActiveServices(): Promise<number> {
  return createAdminDashboardRepository(getPrisma()).countActiveServices();
}

export async function sumRevenueByStatuses(statuses: OrderStatus[]): Promise<number> {
  return createAdminDashboardRepository(getPrisma()).sumRevenueByStatuses(statuses);
}

export async function findRecentOrders(limit: number): Promise<OrderRecord[]> {
  return createAdminDashboardRepository(getPrisma()).findRecentOrders(limit);
}
