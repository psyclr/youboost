import type { Logger } from 'pino';
import type { PrismaClient } from '../../../generated/prisma';
import type { OutboxPort } from '../../../shared/outbox';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import type { OrdersRepository } from '../orders.repository';

const QUEUE_NAME = 'pending-payment-expiry';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 100;

export interface PendingPaymentExpiryWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Exposed for tests — process a single batch synchronously. */
  expireStalePendingPayments(): Promise<void>;
}

export interface PendingPaymentExpiryWorkerDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  outbox: OutboxPort;
  config: { pendingPaymentTtlMinutes: number };
  logger: Logger;
}

export function createPendingPaymentExpiryWorker(
  deps: PendingPaymentExpiryWorkerDeps,
): PendingPaymentExpiryWorker {
  const { prisma, ordersRepo, outbox, config, logger } = deps;

  async function expireStalePendingPayments(): Promise<void> {
    const cutoff = new Date(Date.now() - config.pendingPaymentTtlMinutes * 60 * 1000);
    const stale = await ordersRepo.findPendingPaymentOlderThan(cutoff, BATCH_SIZE);
    if (stale.length === 0) {
      logger.debug('No stale PENDING_PAYMENT orders');
      return;
    }

    logger.info(
      { count: stale.length, ttlMinutes: config.pendingPaymentTtlMinutes },
      'Cancelling stale PENDING_PAYMENT orders',
    );

    for (const order of stale) {
      try {
        await prisma.$transaction(async (tx) => {
          await ordersRepo.updateOrderStatus(order.id, {
            status: 'CANCELLED',
            completedAt: new Date(),
          });
          await outbox.emit(
            {
              type: 'order.cancelled',
              aggregateType: 'order',
              aggregateId: order.id,
              userId: order.userId,
              payload: { orderId: order.id, userId: order.userId, refundAmount: 0 },
            },
            tx,
          );
        });
        logger.info({ orderId: order.id }, 'Stale PENDING_PAYMENT order cancelled');
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to expire stale order');
      }
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker(
      QUEUE_NAME,
      async () => {
        await expireStalePendingPayments();
      },
      { retryable: false, concurrency: 1 },
    );

    const q = getNamedQueue(QUEUE_NAME);
    await q.add('pending-payment-expiry-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

    logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Pending-payment expiry worker started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Pending-payment expiry worker stopped');
  }

  return { start, stop, expireStalePendingPayments };
}
