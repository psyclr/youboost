import { getPrisma } from '../../shared/database';
import type { OrderStatus } from '../../generated/prisma';
import type { OrderRecord } from '../orders';

export async function countUsers(): Promise<number> {
  return getPrisma().user.count();
}

export async function countOrders(): Promise<number> {
  return getPrisma().order.count();
}

export async function countActiveServices(): Promise<number> {
  return getPrisma().service.count({ where: { isActive: true } });
}

export async function sumRevenueByStatuses(statuses: OrderStatus[]): Promise<number> {
  const result = await getPrisma().order.aggregate({
    _sum: { price: true },
    where: { status: { in: statuses } },
  });
  return result._sum.price ? Number(result._sum.price) : 0;
}

export async function findRecentOrders(limit: number): Promise<OrderRecord[]> {
  return getPrisma().order.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
