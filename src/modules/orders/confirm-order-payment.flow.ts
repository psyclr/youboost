import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { PaymentRepository, PaymentWithOrders } from '../billing/payment.repository';
import type { OrdersRepository } from './orders.repository';
import type { ProviderSelectorPort } from './ports/provider-selector.port';
import type { ServiceProviderMappingRepository } from '../providers/service-provider-mapping.repository';
import type { ProviderOrderAttemptRepository } from '../providers/provider-order-attempt.repository';
import { submitWithFailover } from './submit-with-failover';

export interface ConfirmOrderPaymentDeps {
  prisma: PrismaClient;
  paymentRepo: PaymentRepository;
  ordersRepo: OrdersRepository;
  providerSelector: ProviderSelectorPort;
  mappingRepo: ServiceProviderMappingRepository;
  attemptRepo: ProviderOrderAttemptRepository;
  outbox: OutboxPort;
  logger: Logger;
}

type PaymentOrder = PaymentWithOrders['orders'][number];

/**
 * Submit a single paid order, trying every panel mapped to its service in
 * priority order (see {@link submitWithFailover}). Concurrency-safe and
 * idempotent: atomically claims the order (PENDING_PAYMENT → PROCESSING) before
 * the failover walk, so a re-delivered webhook sees PROCESSING/FAILED (not
 * PENDING_PAYMENT), the claim returns false, and we never double-submit.
 *
 * Returns true iff THIS call landed the order on a panel. When every panel fails
 * the order ends FAILED (admin-only — the customer keeps seeing "In progress")
 * and `order.fulfilment_exhausted` is emitted for the admin alert. No customer
 * refund or "failed" email — that's the admin's decision.
 */
export async function submitGuestOrder(
  deps: ConfirmOrderPaymentDeps,
  userId: string,
  order: PaymentOrder,
): Promise<boolean> {
  const { prisma, ordersRepo, providerSelector, mappingRepo, attemptRepo, outbox, logger } = deps;

  const claimed = await ordersRepo.claimOrderForSubmission(order.id);
  if (!claimed) {
    logger.info({ orderId: order.id, userId }, 'Order already claimed for submission — skipping');
    return false;
  }

  const outcome = await submitWithFailover(
    { providerSelector, mappingRepo, attemptRepo, logger },
    {
      orderId: order.id,
      userId,
      serviceId: order.serviceId,
      link: order.link,
      quantity: order.quantity,
    },
  );

  if (outcome.ok) {
    await prisma.$transaction(async (tx) => {
      await ordersRepo.updateOrderStatus(order.id, {
        status: 'PROCESSING',
        externalOrderId: outcome.externalOrderId,
        providerId: outcome.providerId,
        remains: order.quantity,
      });
      await outbox.emit(
        {
          type: 'order.created',
          aggregateType: 'order',
          aggregateId: order.id,
          userId,
          payload: { orderId: order.id, userId, status: 'PROCESSING', price: Number(order.price ?? 0) },
        },
        tx,
      );
    });
    logger.info(
      { orderId: order.id, userId, externalOrderId: outcome.externalOrderId },
      'Order confirmed + submitted',
    );
    return true;
  }

  // Every panel failed — admin's problem. The order is FAILED internally; the
  // customer still sees "In progress". Admin decides (retry / refund) from the
  // exhausted alert. No auto-refund, no customer email.
  await prisma.$transaction(async (tx) => {
    await ordersRepo.updateOrderStatus(order.id, { status: 'FAILED', completedAt: new Date() });
    await outbox.emit(
      {
        type: 'order.fulfilment_exhausted',
        aggregateType: 'order',
        aggregateId: order.id,
        userId,
        payload: { orderId: order.id, userId, attempts: outcome.attempts },
      },
      tx,
    );
  });
  logger.error(
    { orderId: order.id, userId, attempts: outcome.attempts },
    'Order fulfilment exhausted — admin alerted',
  );
  return false;
}

/**
 * Invoked when a Payment session completes successfully. Marks the Payment PAID
 * (settlement accounting) and submits every order that is still PENDING_PAYMENT.
 *
 * Idempotent / concurrency-safe. The Payment PAID flag is an accounting marker
 * only; it does NOT gate submission. Each order is guarded by its own atomic
 * claim (PENDING_PAYMENT → PROCESSING in {@link submitGuestOrder}), so safety
 * holds across:
 *   - duplicate / concurrent webhook delivery → per-order claim lets exactly one
 *     delivery submit each order; the rest skip it (no double-fulfilment)
 *   - partial-failure re-delivery → a previously-failed order was reverted to
 *     PENDING_PAYMENT, so a later delivery re-submits the leftovers even though
 *     the Payment is already PAID (the old fast-path return dropped them)
 *   - orders already PROCESSING/CANCELLED → claim returns false → skipped
 */
export async function confirmOrderPayment(
  deps: ConfirmOrderPaymentDeps,
  paymentId: string,
): Promise<void> {
  const { prisma, paymentRepo, outbox, logger } = deps;

  const payment = await paymentRepo.findPaymentWithOrders(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  const wasAlreadyPaid = payment.status === 'PAID';
  if (!wasAlreadyPaid) {
    // Settlement marker (idempotent). The claim result is not used to gate
    // submission — per-order claims guarantee each order is submitted once — but
    // it DOES gate the purchase analytics event: only the delivery that wins the
    // atomic PENDING→PAID flip emits `payment.confirmed`, so a confirmed purchase
    // is reported to analytics exactly once even under concurrent webhooks.
    const claimed = await paymentRepo.claimPaymentForSettlement(paymentId);
    if (claimed) {
      await prisma.$transaction((tx) =>
        outbox.emit(
          {
            type: 'payment.confirmed',
            aggregateType: 'payment',
            aggregateId: paymentId,
            userId: payment.userId,
            payload: {
              paymentId,
              userId: payment.userId,
              amount: Number(payment.amount),
              currency: 'USD',
              metrikaClientId: payment.metrikaClientId,
            },
          },
          tx,
        ),
      );
    }
  }

  const pendingOrders = payment.orders.filter((o) => o.status === 'PENDING_PAYMENT');

  if (pendingOrders.length === 0) {
    if (wasAlreadyPaid) {
      logger.info({ paymentId }, 'Payment already settled — no pending orders to submit');
    } else {
      logger.warn(
        { paymentId, orderCount: payment.orders.length, submittedCount: 0 },
        'payment settled but no pending orders to submit — possible late webhook after TTL expiry',
      );
    }
    return;
  }

  let submittedCount = 0;
  for (const order of pendingOrders) {
    if (await submitGuestOrder(deps, payment.userId, order)) submittedCount++;
  }

  logger.info(
    { paymentId, userId: payment.userId, submittedCount },
    'Payment settled — orders submitted',
  );
}
