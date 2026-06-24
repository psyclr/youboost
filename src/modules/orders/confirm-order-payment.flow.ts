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
  /**
   * Credit the customer's wallet when a paid guest order cannot be fulfilled by
   * the provider (no funds on the panel, unknown service, panel down). The guest
   * paid directly (Stripe/Cryptomus), so the money is returned as wallet balance.
   */
  refundToWallet: (userId: string, amount: number, orderId: string) => Promise<void>;
  logger: Logger;
}

type PaymentOrder = PaymentWithOrders['orders'][number];

/**
 * Submit a single order to its SMM provider. Concurrency-safe and idempotent:
 * atomically claims the order (PENDING_PAYMENT → PROCESSING) before contacting
 * the provider, so two concurrent settlements of the same Payment can never
 * double-submit the same order. Returns true iff THIS call submitted the order;
 * false if another delivery had already claimed it.
 *
 * On provider/persistence failure the order is reverted to PENDING_PAYMENT so a
 * later webhook re-delivery (or the expiry sweeper) can retry/cancel it, and the
 * error is rethrown so the webhook is retried.
 */
export async function submitGuestOrder(
  deps: ConfirmOrderPaymentDeps,
  userId: string,
  order: PaymentOrder,
): Promise<boolean> {
  const { prisma, ordersRepo, servicesRepo, providerSelector, outbox, refundToWallet, logger } =
    deps;

  const service = await servicesRepo.findServiceById(order.serviceId);

  // Atomic per-order claim: only one concurrent settlement proceeds to submit.
  // It also makes failure handling exactly-once — a re-delivered webhook sees the
  // order in PROCESSING/FAILED (not PENDING_PAYMENT) and the claim skips it, so we
  // never double-submit or double-refund.
  const claimed = await ordersRepo.claimOrderForSubmission(order.id);
  if (!claimed) {
    logger.info({ orderId: order.id, userId }, 'Order already claimed for submission — skipping');
    return false;
  }

  try {
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
    return true;
  } catch (err) {
    // The provider could not accept this paid order (no funds on the panel,
    // unknown service, panel down). Never strand a paid order: refund the
    // customer to their wallet, mark the order FAILED, and notify. We don't
    // rethrow — the webhook stays 200 and the remaining orders still settle.
    // Refund first so a crash before the status flip errs toward refunding.
    const amount = Number(order.price ?? 0);
    const reason = err instanceof Error ? err.message : 'Provider submission failed';
    logger.error(
      { orderId: order.id, userId, amount, err },
      'Provider submission failed — refunding to wallet and failing order',
    );
    await refundToWallet(userId, amount, order.id);
    await prisma.$transaction(async (tx) => {
      await ordersRepo.updateOrderStatus(order.id, { status: 'FAILED', completedAt: new Date() });
      await outbox.emit(
        {
          type: 'order.failed',
          aggregateType: 'order',
          aggregateId: order.id,
          userId,
          payload: { orderId: order.id, userId, reason },
        },
        tx,
      );
    });
    return false;
  }
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
