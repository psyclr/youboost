import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { toNumber } from '../billing/utils/decimal';
import { holdFunds, releaseFunds } from '../billing';
import { selectProvider } from '../providers';
import * as serviceRepo from './service.repository';
import * as ordersRepo from './orders.repository';
import { enqueueWebhookDelivery } from '../webhooks';
import { enqueueNotification } from '../notifications';
import type {
  CreateOrderInput,
  OrdersQuery,
  OrderDetailed,
  PaginatedOrders,
  CancelOrderResponse,
  OrderRecord,
} from './orders.types';

const log = createServiceLogger('orders');

const CANCELLABLE_STATUSES = new Set(['PENDING', 'PROCESSING']);

function calculatePrice(quantity: number, pricePer1000: number): number {
  return Math.round(((quantity * pricePer1000) / 1000) * 100) / 100;
}

function mapOrderToDetailed(order: OrderRecord): OrderDetailed {
  return {
    orderId: order.id,
    serviceId: order.serviceId,
    status: order.status,
    quantity: order.quantity,
    completed: order.quantity - (order.remains ?? order.quantity),
    price: toNumber(order.price),
    createdAt: order.createdAt,
    link: order.link,
    startCount: order.startCount,
    remains: order.remains,
    updatedAt: order.updatedAt,
    comments: null,
  };
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<OrderDetailed> {
  const service = await serviceRepo.findServiceById(input.serviceId);
  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }
  if (!service.isActive) {
    throw new ValidationError('Service is not available', 'SERVICE_INACTIVE');
  }

  if (input.quantity < service.minQuantity || input.quantity > service.maxQuantity) {
    throw new ValidationError(
      `Quantity must be between ${service.minQuantity} and ${service.maxQuantity}`,
      'INVALID_QUANTITY',
    );
  }

  const price = calculatePrice(input.quantity, toNumber(service.pricePer1000));

  const order = await ordersRepo.createOrder({
    userId,
    serviceId: input.serviceId,
    link: input.link,
    quantity: input.quantity,
    price,
  });

  await holdFunds(userId, price, order.id);

  const { providerId, client } = await selectProvider();
  const submitResult = await client.submitOrder({
    serviceId: input.serviceId,
    link: input.link,
    quantity: input.quantity,
  });

  const updated = await ordersRepo.updateOrderStatus(order.id, {
    status: 'PROCESSING',
    externalOrderId: submitResult.externalOrderId,
    providerId,
    remains: input.quantity,
  });

  log.info({ userId, orderId: order.id, price }, 'Order created');

  enqueueWebhookDelivery(userId, 'order.created', {
    orderId: order.id,
    status: updated.status,
    price,
  }).catch(() => {
    /* fire-and-forget */
  });

  enqueueNotification({
    userId,
    type: 'EMAIL',
    channel: 'user-email',
    subject: 'Order Created',
    body: `Your order ${order.id} has been created.`,
    eventType: 'order.created',
    referenceType: 'order',
    referenceId: order.id,
  }).catch(() => {
    /* fire-and-forget */
  });

  return mapOrderToDetailed(updated);
}

export async function getOrder(userId: string, orderId: string): Promise<OrderDetailed> {
  const order = await ordersRepo.findOrderById(orderId, userId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }
  return mapOrderToDetailed(order);
}

export async function listOrders(userId: string, query: OrdersQuery): Promise<PaginatedOrders> {
  const { orders, total } = await ordersRepo.findOrders(userId, {
    status: query.status,
    serviceId: query.serviceId,
    page: query.page,
    limit: query.limit,
  });

  return {
    orders: orders.map((o) => ({
      orderId: o.id,
      serviceId: o.serviceId,
      status: o.status,
      quantity: o.quantity,
      completed: o.quantity - (o.remains ?? o.quantity),
      price: toNumber(o.price),
      createdAt: o.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function cancelOrder(userId: string, orderId: string): Promise<CancelOrderResponse> {
  const order = await ordersRepo.findOrderById(orderId, userId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }

  if (!CANCELLABLE_STATUSES.has(order.status)) {
    throw new ValidationError('Order cannot be cancelled', 'ORDER_NOT_CANCELLABLE');
  }

  const refundAmount = toNumber(order.price);
  await releaseFunds(userId, refundAmount, orderId);

  const updated = await ordersRepo.updateOrderStatus(orderId, {
    status: 'CANCELLED',
    completedAt: new Date(),
  });

  log.info({ userId, orderId, refundAmount }, 'Order cancelled');

  enqueueWebhookDelivery(userId, 'order.cancelled', {
    orderId: updated.id,
    status: updated.status,
    refundAmount,
  }).catch(() => {
    /* fire-and-forget */
  });

  enqueueNotification({
    userId,
    type: 'EMAIL',
    channel: 'user-email',
    subject: 'Order Cancelled',
    body: `Your order ${orderId} has been cancelled. Refund: $${refundAmount}.`,
    eventType: 'order.cancelled',
    referenceType: 'order',
    referenceId: orderId,
  }).catch(() => {
    /* fire-and-forget */
  });

  return {
    orderId: updated.id,
    status: updated.status,
    refundAmount,
    cancelledAt: updated.completedAt ?? new Date(),
  };
}
