import { ValidationError, NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { releaseFunds } from '../billing';
import { validateCoupon } from '../coupons';
import { selectProviderById } from '../providers';
import { enqueueWebhookDelivery } from '../webhooks';
import { enqueueNotification } from '../notifications';
import * as ordersRepo from './orders.repository';
import type { ServiceRecord, OrderRecord } from './orders.types';

const log = createServiceLogger('orders');

export async function warnIfProviderBalanceLow(
  providerId: string | null,
  orderPrice: number,
): Promise<void> {
  if (!providerId) return;
  try {
    const { client } = await selectProviderById(providerId);
    const providerBalance = await client.checkBalance();
    if (providerBalance.balance < orderPrice) {
      log.warn(
        { providerId, providerBalance: providerBalance.balance, orderPrice },
        'Provider balance may be insufficient for order',
      );
    }
  } catch {
    // Non-blocking — provider balance check failure should never prevent orders
  }
}

export function calculatePrice(quantity: number, pricePer1000: number): number {
  const priceInCents = Math.round((quantity * pricePer1000 * 100) / 1000);
  return priceInCents / 100;
}

export function validateService(service: ServiceRecord | null): void {
  if (!service) {
    throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
  }
  if (!service.isActive) {
    throw new ValidationError('Service is not available', 'SERVICE_INACTIVE');
  }
  if (!service.providerId || !service.externalServiceId) {
    throw new ValidationError('Service is not linked to a provider', 'SERVICE_NO_PROVIDER');
  }
}

export function validateQuantity(quantity: number, minQuantity: number, maxQuantity: number): void {
  if (quantity < minQuantity || quantity > maxQuantity) {
    throw new ValidationError(
      `Quantity must be between ${minQuantity} and ${maxQuantity}`,
      'INVALID_QUANTITY',
    );
  }
}

export async function applyOrderCoupon(
  couponCode: string | undefined,
  price: number,
): Promise<{ finalPrice: number; couponId: string | null; discount: number }> {
  if (!couponCode) {
    return { finalPrice: price, couponId: null, discount: 0 };
  }

  const couponResult = await validateCoupon(couponCode, price);
  if (!couponResult.valid) {
    throw new ValidationError(couponResult.reason ?? 'Invalid coupon', 'INVALID_COUPON');
  }

  const discount = couponResult.discount;
  const finalPrice = Math.max(0, Math.round((price - discount) * 100) / 100);
  return { finalPrice, couponId: couponResult.couponId, discount };
}

export async function handleOrderCreationFailure(params: {
  userId: string;
  orderId: string;
  price: number;
  error: unknown;
}): Promise<void> {
  const { userId, orderId, price, error } = params;
  log.error({ userId, orderId, error }, 'Order creation failed, releasing funds');
  await releaseFunds(userId, price, orderId).catch((releaseError) => {
    log.error({ userId, orderId, releaseError }, 'Failed to release funds');
  });

  await ordersRepo
    .updateOrderStatus(orderId, {
      status: 'FAILED',
      completedAt: new Date(),
    })
    .catch((updateError) => {
      log.error({ userId, orderId, updateError }, 'Failed to update order status to FAILED');
    });
}

export function dispatchOrderNotifications(params: {
  userId: string;
  orderId: string;
  status: string;
  price: number;
}): void {
  const { userId, orderId, status, price } = params;
  enqueueWebhookDelivery(userId, 'order.created', {
    orderId,
    status,
    price,
  }).catch(() => {
    /* fire-and-forget */
  });

  enqueueNotification({
    userId,
    type: 'EMAIL',
    channel: 'user-email',
    subject: 'Order Created',
    body: `Your order ${orderId} has been created.`,
    eventType: 'order.created',
    referenceType: 'order',
    referenceId: orderId,
  }).catch(() => {
    /* fire-and-forget */
  });
}

export function dispatchCancelNotifications(params: {
  userId: string;
  orderId: string;
  status: string;
  refundAmount: number;
}): void {
  const { userId, orderId, status, refundAmount } = params;
  enqueueWebhookDelivery(userId, 'order.cancelled', {
    orderId,
    status,
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
}

export function mapOrderToDetailed(order: OrderRecord): {
  orderId: string;
  serviceId: string;
  status: string;
  quantity: number;
  completed: number;
  price: number;
  createdAt: Date;
  link: string;
  startCount: number | null;
  remains: number | null;
  updatedAt: Date;
  comments: null;
  isDripFeed: boolean;
  dripFeedRuns: number | null;
  dripFeedInterval: number | null;
  dripFeedRunsCompleted: number;
  refillEligibleUntil: Date | null;
  refillCount: number;
} {
  return {
    orderId: order.id,
    serviceId: order.serviceId,
    status: order.status,
    quantity: order.quantity,
    completed: order.quantity - (order.remains ?? order.quantity),
    price: Number(order.price),
    createdAt: order.createdAt,
    link: order.link,
    startCount: order.startCount,
    remains: order.remains,
    updatedAt: order.updatedAt,
    comments: null,
    isDripFeed: order.isDripFeed,
    dripFeedRuns: order.dripFeedRuns,
    dripFeedInterval: order.dripFeedInterval,
    dripFeedRunsCompleted: order.dripFeedRunsCompleted ?? 0,
    refillEligibleUntil: order.refillEligibleUntil,
    refillCount: order.refillCount,
  };
}
