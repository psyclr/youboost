import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { fireAndForget } from '../../shared/utils/fire-and-forget';
import { holdFunds, releaseFunds } from '../billing';
import { selectProviderById } from '../providers';
import { applyCoupon } from '../coupons';
import * as serviceRepo from './service.repository';
import * as ordersRepo from './orders.repository';
import {
  calculatePrice,
  validateService,
  validateQuantity,
  applyOrderCoupon,
  warnIfProviderBalanceLow,
  handleOrderCreationFailure,
  dispatchOrderNotifications,
  dispatchCancelNotifications,
  mapOrderToDetailed,
} from './orders.helpers';
import type {
  CreateOrderInput,
  OrdersQuery,
  OrderDetailed,
  PaginatedOrders,
  CancelOrderResponse,
  BulkOrderInput,
  BulkOrderResult,
  ServiceRecord,
} from './orders.types';

const log = createServiceLogger('orders');

const CANCELLABLE_STATUSES = new Set(['PENDING', 'PROCESSING']);

async function submitOrderToProvider(params: {
  service: ServiceRecord;
  input: CreateOrderInput;
  isDripFeed: boolean;
  dripFeedRuns: number | undefined;
}): Promise<{ providerId: string | null; externalOrderId: string }> {
  const { service, input, isDripFeed, dripFeedRuns } = params;

  if (!service.providerId || !service.externalServiceId) {
    throw new ValidationError('Service provider info missing', 'SERVICE_PROVIDER_MISSING');
  }

  const { providerId, client } = await selectProviderById(service.providerId);

  const submitQuantity =
    isDripFeed && dripFeedRuns ? Math.ceil(input.quantity / dripFeedRuns) : input.quantity;

  const submitResult = await client.submitOrder({
    serviceId: service.externalServiceId,
    link: input.link,
    quantity: submitQuantity,
  });

  return { providerId, externalOrderId: submitResult.externalOrderId };
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<OrderDetailed> {
  const service = await serviceRepo.findServiceById(input.serviceId);
  validateService(service);

  // After validateService, we know service is not null and has required fields
  const validatedService = service as ServiceRecord;
  validateQuantity(input.quantity, validatedService.minQuantity, validatedService.maxQuantity);

  const basePrice = calculatePrice(input.quantity, Number(validatedService.pricePer1000));
  const { finalPrice, couponId, discount } = await applyOrderCoupon(input.couponCode, basePrice);

  const isDripFeed = input.isDripFeed ?? false;
  const dripFeedRuns = isDripFeed ? input.dripFeedRuns : undefined;
  const dripFeedInterval = isDripFeed ? input.dripFeedInterval : undefined;

  await warnIfProviderBalanceLow(validatedService.providerId, finalPrice);

  const order = await ordersRepo.createOrder({
    userId,
    serviceId: input.serviceId,
    link: input.link,
    quantity: input.quantity,
    price: finalPrice,
    isDripFeed,
    dripFeedRuns,
    dripFeedInterval,
    dripFeedRunsCompleted: isDripFeed ? 1 : 0,
    couponId,
    discount,
  });

  try {
    await holdFunds(userId, finalPrice, order.id);

    const { providerId, externalOrderId } = await submitOrderToProvider({
      service: validatedService,
      input,
      isDripFeed,
      dripFeedRuns,
    });

    const updated = await ordersRepo.updateOrderStatus(order.id, {
      status: 'PROCESSING',
      externalOrderId,
      ...(providerId ? { providerId } : {}),
      remains: input.quantity,
    });

    if (couponId) {
      fireAndForget(applyCoupon(couponId), {
        operation: 'apply coupon usage',
        logger: log,
        extra: { userId, orderId: order.id, couponId },
      });
    }

    log.info(
      { userId, orderId: order.id, price: finalPrice, discount, isDripFeed },
      'Order created',
    );
    dispatchOrderNotifications({
      userId,
      orderId: order.id,
      status: updated.status,
      price: finalPrice,
    });

    return mapOrderToDetailed(updated);
  } catch (error) {
    await handleOrderCreationFailure({ userId, orderId: order.id, price: finalPrice, error });
    throw error;
  }
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
      price: Number(o.price),
      createdAt: o.createdAt,
      isDripFeed: o.isDripFeed,
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

  const refundAmount = Number(order.price);
  await releaseFunds(userId, refundAmount, orderId);

  const updated = await ordersRepo.updateOrderStatus(orderId, {
    status: 'CANCELLED',
    completedAt: new Date(),
  });

  log.info({ userId, orderId, refundAmount }, 'Order cancelled');
  dispatchCancelNotifications({
    userId,
    orderId: updated.id,
    status: updated.status,
    refundAmount,
  });

  return {
    orderId: updated.id,
    status: updated.status,
    refundAmount,
    cancelledAt: updated.completedAt ?? new Date(),
  };
}

export async function refillOrder(userId: string, orderId: string): Promise<OrderDetailed> {
  const order = await ordersRepo.findOrderById(orderId, userId);
  if (!order) {
    throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'COMPLETED') {
    throw new ValidationError('Only completed orders can be refilled', 'ORDER_NOT_COMPLETED');
  }

  if (!order.refillEligibleUntil || order.refillEligibleUntil < new Date()) {
    throw new ValidationError('Order is not eligible for refill', 'REFILL_EXPIRED');
  }

  const service = await serviceRepo.findServiceById(order.serviceId);
  if (!service?.providerId || !service?.externalServiceId) {
    throw new ValidationError('Service is no longer available for refill', 'SERVICE_UNAVAILABLE');
  }

  // Create a new order at $0 for the refill
  const refillOrderRecord = await ordersRepo.createOrder({
    userId,
    serviceId: order.serviceId,
    link: order.link,
    quantity: order.quantity,
    price: 0,
  });

  // Submit to provider
  const { providerId, client } = await selectProviderById(service.providerId);
  const submitResult = await client.submitOrder({
    serviceId: service.externalServiceId,
    link: order.link,
    quantity: order.quantity,
  });

  const updated = await ordersRepo.updateOrderStatus(refillOrderRecord.id, {
    status: 'PROCESSING',
    externalOrderId: submitResult.externalOrderId,
    ...(providerId ? { providerId } : {}),
    remains: order.quantity,
  });

  // Increment refill count on original order
  await ordersRepo.incrementRefillCount(orderId);

  log.info({ userId, orderId, refillOrderId: refillOrderRecord.id }, 'Order refill created');

  return mapOrderToDetailed(updated);
}

export async function setRefillEligibility(orderId: string, refillDays: number): Promise<void> {
  const eligibleUntil = new Date();
  eligibleUntil.setDate(eligibleUntil.getDate() + refillDays);
  await ordersRepo.updateOrderStatus(orderId, {
    status: 'COMPLETED',
    refillEligibleUntil: eligibleUntil,
    completedAt: new Date(),
  });
}

export async function createBulkOrders(
  userId: string,
  input: BulkOrderInput,
): Promise<BulkOrderResult> {
  const results: BulkOrderResult['results'] = [];

  for (const item of input.links) {
    try {
      const order = await createOrder(userId, {
        serviceId: input.serviceId,
        link: item.link,
        quantity: item.quantity ?? input.defaultQuantity,
        isDripFeed: false,
        comments: input.comments,
      });
      results.push({ link: item.link, orderId: order.orderId, status: 'success' });
    } catch (error) {
      results.push({
        link: item.link,
        orderId: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const totalCreated = results.filter((r) => r.status === 'success').length;
  const totalFailed = results.length - totalCreated;
  log.info({ userId, totalCreated, totalFailed }, 'Bulk orders created');

  return { results, totalCreated, totalFailed };
}
