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
    },
  });
}

export async function findOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
  const prisma = getPrisma();
  return prisma.order.findFirst({
    where: { id: orderId, userId },
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

  return prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });
}
