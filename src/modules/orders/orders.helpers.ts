import type { Logger } from 'pino';
import { ValidationError, NotFoundError } from '../../shared/errors';
import type { OrdersRepository } from './orders.repository';
import type { ServiceRecord, OrderRecord } from './orders.types';
import type { ProviderSelectorPort } from './ports/provider-selector.port';

type ValidateCouponFn = (
  code: string,
  orderAmount?: number,
) => Promise<{
  valid: boolean;
  discount: number;
  couponId: string | null;
  reason?: string;
}>;

type ReleaseFundsFn = (userId: string, amount: number, referenceId: string) => Promise<void>;

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
  validateCoupon: ValidateCouponFn,
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

export async function warnIfProviderBalanceLow(
  deps: { providerSelector: ProviderSelectorPort; logger: Logger },
  providerId: string | null,
  orderPrice: number,
): Promise<void> {
  if (!providerId) return;
  const { providerSelector, logger } = deps;
  try {
    const { client } = await providerSelector.selectProviderById(providerId);
    const providerBalance = await client.checkBalance();
    if (providerBalance.balance < orderPrice) {
      logger.warn(
        { providerId, providerBalance: providerBalance.balance, orderPrice },
        'Provider balance may be insufficient for order',
      );
    }
  } catch {
    // Non-blocking — provider balance check failure should never prevent orders
  }
}

export async function handleOrderCreationFailure(
  deps: { ordersRepo: OrdersRepository; releaseFunds: ReleaseFundsFn; logger: Logger },
  params: {
    userId: string;
    orderId: string;
    price: number;
    error: unknown;
  },
): Promise<void> {
  const { ordersRepo, releaseFunds, logger } = deps;
  const { userId, orderId, price, error } = params;
  logger.error({ userId, orderId, error }, 'Order creation failed, releasing funds');
  await releaseFunds(userId, price, orderId).catch((releaseError) => {
    logger.error({ userId, orderId, releaseError }, 'Failed to release funds');
  });

  await ordersRepo
    .updateOrderStatus(orderId, {
      status: 'FAILED',
      completedAt: new Date(),
    })
    .catch((updateError) => {
      logger.error({ userId, orderId, updateError }, 'Failed to update order status to FAILED');
    });
}

export function mapOrderToResponse(order: OrderRecord): {
  orderId: string;
  serviceId: string;
  status: string;
  quantity: number;
  completed: number;
  price: number;
  createdAt: Date;
  isDripFeed: boolean;
} {
  return {
    orderId: order.id,
    serviceId: order.serviceId,
    status: order.status,
    quantity: order.quantity,
    completed: order.quantity - (order.remains ?? order.quantity),
    price: Number(order.price),
    createdAt: order.createdAt,
    isDripFeed: order.isDripFeed,
  };
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
