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
  const { prisma, ordersRepo, servicesRepo, providerSelector, outbox, logger } = deps;

  const service = await servicesRepo.findServiceById(order.serviceId);
  if (!service?.providerId || !service?.externalServiceId) {
    throw new ValidationError('Service provider info missing', 'SERVICE_PROVIDER_MISSING');
  }

  // Atomic per-order claim: only one concurrent settlement proceeds to submit.
  const claimed = await ordersRepo.claimOrderForSubmission(order.id);
  if (!claimed) {
    logger.info({ orderId: order.id, userId }, 'Order already claimed for submission — skipping');
    return false;
  }

  try {
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
    // Release the claim so a later delivery (or expiry sweeper) can retry/cancel.
    await ordersRepo.updateOrderStatus(order.id, { status: 'PENDING_PAYMENT' });
    throw err;
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
  const { paymentRepo, logger } = deps;

  const payment = await paymentRepo.findPaymentWithOrders(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
  }

  const wasAlreadyPaid = payment.status === 'PAID';
  if (!wasAlreadyPaid) {
    // Settlement marker (idempotent). Result is intentionally not used to gate
    // submission — per-order claims guarantee each order is submitted once.
    await paymentRepo.claimPaymentForSettlement(paymentId);
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
