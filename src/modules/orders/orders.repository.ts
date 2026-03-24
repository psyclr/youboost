import { getPrisma } from '../../shared/database';
import type { OrderStatus } from '../../generated/prisma';
import type { OrderRecord, CreateOrderData, UpdateOrderData } from './orders.types';

export async function createOrder(data: CreateOrderData): Promise<OrderRecord> {
  const prisma = getPrisma();
  return prisma.order.create({
    data: {
      userId: data.userId,
      serviceId: data.serviceId,
      link: data.link,
      quantity: data.quantity,
      price: data.price,
      isDripFeed: data.isDripFeed ?? false,
      dripFeedRuns: data.dripFeedRuns ?? null,
      dripFeedInterval: data.dripFeedInterval ?? null,
      dripFeedRunsCompleted: data.dripFeedRunsCompleted ?? 0,
      ...(data.couponId ? { couponId: data.couponId } : {}),
      ...(data.discount ? { discount: data.discount } : {}),
    },
  });
}

export async function findOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
  const prisma = getPrisma();
  return prisma.order.findFirst({
    where: { id: orderId, userId },
  });
}

export async function findOrderByIdAnyUser(orderId: string): Promise<OrderRecord | null> {
  const prisma = getPrisma();
  return prisma.order.findUnique({
    where: { id: orderId },
  });
}

interface OrderFilters {
  status?: string | undefined;
  serviceId?: string | undefined;
  page: number;
  limit: number;
}

export async function findOrders(
  userId: string,
  filters: OrderFilters,
): Promise<{ orders: OrderRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { userId };
  if (filters.status) {
    where.status = filters.status as OrderStatus;
  }
  if (filters.serviceId) {
    where.serviceId = filters.serviceId;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

export async function findProcessingOrders(batchSize: number): Promise<OrderRecord[]> {
  const prisma = getPrisma();
  return prisma.order.findMany({
    where: { status: 'PROCESSING' as OrderStatus, externalOrderId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });
}

export async function updateOrderStatus(
  orderId: string,
  data: UpdateOrderData,
): Promise<OrderRecord> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = { status: data.status as OrderStatus };

  if (data.completedAt != null) updateData.completedAt = data.completedAt;
  if (data.startCount != null) updateData.startCount = data.startCount;
  if (data.remains != null) updateData.remains = data.remains;
  if (data.providerId != null) updateData.providerId = data.providerId;
  if (data.externalOrderId != null) updateData.externalOrderId = data.externalOrderId;
  if (data.refillEligibleUntil !== undefined)
    updateData.refillEligibleUntil = data.refillEligibleUntil;
  if (data.dripFeedRunsCompleted != null)
    updateData.dripFeedRunsCompleted = data.dripFeedRunsCompleted;

  return prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });
}

export async function findDripFeedOrdersDue(): Promise<OrderRecord[]> {
  const prisma = getPrisma();
  const now = new Date();

  // Find drip-feed orders that are PROCESSING, not paused, and have remaining runs
  const orders = await prisma.order.findMany({
    where: {
      isDripFeed: true,
      status: 'PROCESSING' as OrderStatus,
      dripFeedRuns: { not: null },
      dripFeedRunsCompleted: { gt: 0 },
      dripFeedPausedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Filter in JS: next run is due based on updatedAt + interval
  return orders.filter((order) => {
    if (!order.dripFeedRuns || !order.dripFeedInterval) return false;
    if (order.dripFeedRunsCompleted >= order.dripFeedRuns) return false;
    const nextRunAt = new Date(order.updatedAt.getTime() + order.dripFeedInterval * 60_000);
    return nextRunAt <= now;
  });
}

export async function incrementDripFeedRun(orderId: string): Promise<OrderRecord> {
  const prisma = getPrisma();
  return prisma.order.update({
    where: { id: orderId },
    data: { dripFeedRunsCompleted: { increment: 1 } },
  });
}

export async function incrementRefillCount(orderId: string): Promise<OrderRecord> {
  const prisma = getPrisma();
  return prisma.order.update({
    where: { id: orderId },
    data: { refillCount: { increment: 1 } },
  });
}

export async function pauseDripFeed(orderId: string): Promise<OrderRecord> {
  const prisma = getPrisma();
  return prisma.order.update({
    where: { id: orderId },
    data: { dripFeedPausedAt: new Date() },
  });
}

export async function resumeDripFeed(orderId: string): Promise<OrderRecord> {
  const prisma = getPrisma();
  return prisma.order.update({
    where: { id: orderId },
    data: { dripFeedPausedAt: null, updatedAt: new Date() },
  });
}

export async function findAllOrders(filters: {
  status?: string | undefined;
  userId?: string | undefined;
  isDripFeed?: boolean | undefined;
  page: number;
  limit: number;
}): Promise<{ orders: OrderRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters.status) {
    where.status = filters.status as OrderStatus;
  }
  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.isDripFeed !== undefined) {
    where.isDripFeed = filters.isDripFeed;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

export { findOrderByIdAnyUser as findOrderByIdAdmin };
