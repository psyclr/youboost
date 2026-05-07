import { getPrisma } from '../../shared/database';
import type { OrderStatus, PrismaClient } from '../../generated/prisma';
import type { OrderRecord, CreateOrderData, UpdateOrderData } from './orders.types';

interface OrderFilters {
  status?: string | undefined;
  serviceId?: string | undefined;
  page: number;
  limit: number;
}

export interface OrdersRepository {
  createOrder(data: CreateOrderData): Promise<OrderRecord>;
  findOrderById(orderId: string, userId: string): Promise<OrderRecord | null>;
  findOrders(
    userId: string,
    filters: OrderFilters,
  ): Promise<{ orders: OrderRecord[]; total: number }>;
  findProcessingOrders(batchSize: number): Promise<OrderRecord[]>;
  updateOrderStatus(orderId: string, data: UpdateOrderData): Promise<OrderRecord>;
  findDripFeedOrdersDue(): Promise<OrderRecord[]>;
  incrementDripFeedRun(orderId: string): Promise<OrderRecord>;
  incrementRefillCount(orderId: string): Promise<OrderRecord>;
  pauseDripFeed(orderId: string): Promise<OrderRecord>;
  resumeDripFeed(orderId: string): Promise<OrderRecord>;
  findTimedOutOrders(timeoutHours: number): Promise<OrderRecord[]>;
  findAllOrders(filters: {
    status?: string | undefined;
    userId?: string | undefined;
    isDripFeed?: boolean | undefined;
    page: number;
    limit: number;
  }): Promise<{ orders: OrderRecord[]; total: number }>;
  findOrderByIdAdmin(orderId: string): Promise<OrderRecord | null>;
}

export function createOrdersRepository(prisma: PrismaClient): OrdersRepository {
  async function createOrder(data: CreateOrderData): Promise<OrderRecord> {
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

  async function findOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
    });
  }

  async function findOrders(
    userId: string,
    filters: OrderFilters,
  ): Promise<{ orders: OrderRecord[]; total: number }> {
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

  async function findProcessingOrders(batchSize: number): Promise<OrderRecord[]> {
    return prisma.order.findMany({
      where: { status: 'PROCESSING' as OrderStatus, externalOrderId: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });
  }

  async function updateOrderStatus(orderId: string, data: UpdateOrderData): Promise<OrderRecord> {
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

  async function findDripFeedOrdersDue(): Promise<OrderRecord[]> {
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

  async function incrementDripFeedRun(orderId: string): Promise<OrderRecord> {
    return prisma.order.update({
      where: { id: orderId },
      data: { dripFeedRunsCompleted: { increment: 1 } },
    });
  }

  async function incrementRefillCount(orderId: string): Promise<OrderRecord> {
    return prisma.order.update({
      where: { id: orderId },
      data: { refillCount: { increment: 1 } },
    });
  }

  async function pauseDripFeed(orderId: string): Promise<OrderRecord> {
    return prisma.order.update({
      where: { id: orderId },
      data: { dripFeedPausedAt: new Date() },
    });
  }

  async function resumeDripFeed(orderId: string): Promise<OrderRecord> {
    return prisma.order.update({
      where: { id: orderId },
      data: { dripFeedPausedAt: null, updatedAt: new Date() },
    });
  }

  async function findTimedOutOrders(timeoutHours: number): Promise<OrderRecord[]> {
    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);
    return prisma.order.findMany({
      where: {
        status: 'PROCESSING' as OrderStatus,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
  }

  async function findAllOrders(filters: {
    status?: string | undefined;
    userId?: string | undefined;
    isDripFeed?: boolean | undefined;
    page: number;
    limit: number;
  }): Promise<{ orders: OrderRecord[]; total: number }> {
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

  async function findOrderByIdAdmin(orderId: string): Promise<OrderRecord | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
    });
  }

  return {
    createOrder,
    findOrderById,
    findOrders,
    findProcessingOrders,
    updateOrderStatus,
    findDripFeedOrdersDue,
    incrementDripFeedRun,
    incrementRefillCount,
    pauseDripFeed,
    resumeDripFeed,
    findTimedOutOrders,
    findAllOrders,
    findOrderByIdAdmin,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createOrder(data: CreateOrderData): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).createOrder(data);
}

export async function findOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
  return createOrdersRepository(getPrisma()).findOrderById(orderId, userId);
}

export async function findOrders(
  userId: string,
  filters: OrderFilters,
): Promise<{ orders: OrderRecord[]; total: number }> {
  return createOrdersRepository(getPrisma()).findOrders(userId, filters);
}

export async function findProcessingOrders(batchSize: number): Promise<OrderRecord[]> {
  return createOrdersRepository(getPrisma()).findProcessingOrders(batchSize);
}

export async function updateOrderStatus(
  orderId: string,
  data: UpdateOrderData,
): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).updateOrderStatus(orderId, data);
}

export async function findDripFeedOrdersDue(): Promise<OrderRecord[]> {
  return createOrdersRepository(getPrisma()).findDripFeedOrdersDue();
}

export async function incrementDripFeedRun(orderId: string): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).incrementDripFeedRun(orderId);
}

export async function incrementRefillCount(orderId: string): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).incrementRefillCount(orderId);
}

export async function pauseDripFeed(orderId: string): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).pauseDripFeed(orderId);
}

export async function resumeDripFeed(orderId: string): Promise<OrderRecord> {
  return createOrdersRepository(getPrisma()).resumeDripFeed(orderId);
}

export async function findTimedOutOrders(timeoutHours: number): Promise<OrderRecord[]> {
  return createOrdersRepository(getPrisma()).findTimedOutOrders(timeoutHours);
}

export async function findAllOrders(filters: {
  status?: string | undefined;
  userId?: string | undefined;
  isDripFeed?: boolean | undefined;
  page: number;
  limit: number;
}): Promise<{ orders: OrderRecord[]; total: number }> {
  return createOrdersRepository(getPrisma()).findAllOrders(filters);
}

export async function findOrderByIdAdmin(orderId: string): Promise<OrderRecord | null> {
  return createOrdersRepository(getPrisma()).findOrderByIdAdmin(orderId);
}
