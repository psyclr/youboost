import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { PaymentRepository, PaymentWithOrders } from '../billing/payment.repository';
import type { OrdersRepository } from './orders.repository';
import type { ServicesRepository } from './service.repository';
import type { ProviderSelectorPort } from './ports/provider-selector.port';

export interface ConfirmOrderPaymentDeps {
  prisma: PrismaClient;
  paymentRepo: PaymentRepository;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  providerSelector: ProviderSelectorPort;
  outbox: OutboxPort;
  logger: Logger;
}

type PaymentOrder = PaymentWithOrders['orders'][number];

/**
 * Submit a single PENDING_PAYMENT order to its SMM provider, then flip it to
 * PROCESSING and emit `order.created`. Extracted from confirm-guest-order.flow
 * so the multi-order Payment settlement can reuse the same per-order logic.
 */
export async function submitGuestOrder(
  deps: ConfirmOrderPaymentDeps,
  userId: string,
  order: PaymentOrder,
): Promise<void> {
  const { prisma, ordersRepo, servicesRepo, providerSelector, outbox, logger } = deps;

  const service = await servicesRepo.findServiceById(order.serviceId);
  if (!service?.providerId || !service?.externalServiceId) {
    throw new ValidationError('Service provider info missing', 'SERVICE_PROVIDER_MISSING');
  }

  const { providerId, client } = await providerSelector.selectProviderById(service.providerId);
  const submitResult = await client.submitOrder({
    serviceId: service.externalServiceId,
    link: order.link,
    quantity: order.quantity,
  });

  await prisma.$transaction(async (tx) => {
    await ordersRepo.updateOrderStatus(order.id, {
      status: 'PROCESSING',
      externalOrderId: submitResult.externalOrderId,
      ...(providerId ? { providerId } : {}),
      remains: order.quantity,
    });
    await outbox.emit(
      {
        type: 'order.created',
        aggregateType: 'order',
        aggregateId: order.id,
        userId,
        payload: {
          orderId: order.id,
          userId,
          status: 'PROCESSING',
          price: Number(order.price ?? 0),
        },
      },
      tx,
    );
  });

  logger.info(
    { orderId: order.id, userId, externalOrderId: submitResult.externalOrderId },
    'Order confirmed + submitted',
  );
}

/**
 * Invoked when a Payment session completes successfully. Atomically claims the
 * Payment for settlement (PENDING→PAID via compare-and-set) and submits every
 * order that is still PENDING_PAYMENT.
 *
 * Idempotent / concurrency-safe:
 *   - already-PAID payment (fast path) → no-op before any DB write
 *   - claimPaymentForSettlement returns false (another concurrent delivery
 *     already won the CAS race, or payment is not PENDING) → no-op, no orders
 *     submitted; prevents double-fulfilment on duplicate webhook delivery
 *   - orders already past PENDING_PAYMENT (partial-failure re-run) → skipped
 */
export async function confirmOrderPayment(
  deps: ConfirmOrderPaymentDeps,
  paymentId: string,
): Promise<void> {
  const { paymentRepo, logger } = deps;

  const payment = await paymentRepo.findPaymentWithOrders(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  // Fast idempotent path: already settled by a previous delivery.
  if (payment.status === 'PAID') {
    logger.info({ paymentId }, 'Payment already settled — skipping');
    return;
  }

  // Atomic CAS: only the first concurrent delivery wins and proceeds.
  const claimed = await paymentRepo.claimPaymentForSettlement(paymentId);
  if (!claimed) {
    logger.info({ paymentId }, 'Payment settlement claimed by concurrent delivery — skipping');
    return;
  }

  const pendingOrders = payment.orders.filter((o) => o.status === 'PENDING_PAYMENT');

  if (pendingOrders.length === 0) {
    logger.warn(
      { paymentId, orderCount: payment.orders.length, submittedCount: 0 },
      'payment settled but no pending orders to submit — possible late webhook after TTL expiry',
    );
    return;
  }

  for (const order of pendingOrders) {
    await submitGuestOrder(deps, payment.userId, order);
  }

  logger.info(
    { paymentId, userId: payment.userId, orderCount: payment.orders.length },
    'Payment settled — orders submitted',
  );
}
