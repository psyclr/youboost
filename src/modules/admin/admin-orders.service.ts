import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as ordersRepo from '../orders/orders.repository';
import * as billingInternal from '../billing/billing-internal.service';
import { toNumber } from '../billing/utils/decimal';
import type { OrderRecord } from '../orders/orders.types';
import type { AdminOrdersQuery, AdminOrderResponse, PaginatedAdminOrders } from './admin.types';

const log = createServiceLogger('admin-orders');

function toOrderResponse(record: OrderRecord): AdminOrderResponse {
  return {
    orderId: record.id,
    userId: record.userId,
    serviceId: record.serviceId,
    status: record.status,
    quantity: record.quantity,
    price: toNumber(record.price),
    link: record.link,
    startCount: record.startCount,
    remains: record.remains,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

export async function listAllOrders(query: AdminOrdersQuery): Promise<PaginatedAdminOrders> {
  const { orders, total } = await ordersRepo.findAllOrders({
    status: query.status,
    userId: query.userId,
    page: query.page,
    limit: query.limit,
  });

  const totalPages = Math.ceil(total / query.limit);

  log.info({ page: query.page, total }, 'Listed all orders');

  return {
    orders: orders.map(toOrderResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
}

export async function getAnyOrder(orderId: string): Promise<AdminOrderResponse> {
  const order = await ordersRepo.findOrderByIdAdmin(orderId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }

  log.info({ orderId }, 'Fetched order detail');

  return toOrderResponse(order);
}

export async function forceOrderStatus(
  orderId: string,
  status: string,
): Promise<AdminOrderResponse> {
  const order = await ordersRepo.findOrderByIdAdmin(orderId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }

  const completedAt = ['COMPLETED', 'PARTIAL', 'CANCELLED', 'FAILED', 'REFUNDED'].includes(status)
    ? new Date()
    : undefined;

  const updated = await ordersRepo.updateOrderStatus(orderId, {
    status,
    completedAt: completedAt ?? null,
  });

  log.info({ orderId, status }, 'Forced order status');

  return toOrderResponse(updated);
}

export async function refundOrder(orderId: string): Promise<AdminOrderResponse> {
  const order = await ordersRepo.findOrderByIdAdmin(orderId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status === 'REFUNDED') {
    throw new ValidationError('Order already refunded', 'ALREADY_REFUNDED');
  }

  const amount = toNumber(order.price);
  await billingInternal.refundFunds(order.userId, amount, orderId);

  const updated = await ordersRepo.updateOrderStatus(orderId, {
    status: 'REFUNDED',
    completedAt: new Date(),
  });

  log.info({ orderId, amount }, 'Refunded order');

  return toOrderResponse(updated);
}
