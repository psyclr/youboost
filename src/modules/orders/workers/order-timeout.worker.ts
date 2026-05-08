import type { Logger } from 'pino';
import type { PrismaClient } from '../../../generated/prisma';
import type { OutboxPort } from '../../../shared/outbox';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import type { ProviderSelectorPort } from '../ports/provider-selector.port';
import type { OrdersRepository } from '../orders.repository';
import type { FundSettlement } from '../utils/fund-settlement';
import { mapProviderStatus, isTerminalStatus } from '../utils/status-mapper';
import type { ProviderClient } from '../utils/provider-client';
import type { OrderRecord } from '../orders.types';

const QUEUE_NAME = 'order-timeout';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export interface OrderTimeoutWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Exposed for tests — process a single batch synchronously. */
  processTimedOutOrders(): Promise<void>;
}

export interface OrderTimeoutWorkerDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  providerSelector: ProviderSelectorPort;
  stubClient: ProviderClient;
  fundSettlement: FundSettlement;
  outbox: OutboxPort;
  config: { orderTimeoutHours: number };
  logger: Logger;
}

function mapTerminalEventType(
  status: string,
): 'order.completed' | 'order.failed' | 'order.partial' | null {
  if (status === 'COMPLETED') return 'order.completed';
  if (status === 'FAILED') return 'order.failed';
  if (status === 'PARTIAL') return 'order.partial';
  return null;
}

export function createOrderTimeoutWorker(deps: OrderTimeoutWorkerDeps): OrderTimeoutWorker {
  const {
    prisma,
    ordersRepo,
    providerSelector,
    stubClient,
    fundSettlement,
    outbox,
    config,
    logger,
  } = deps;

  async function attemptFinalStatusCheck(order: OrderRecord): Promise<string | null> {
    if (!order.externalOrderId || !order.providerId) return null;

    try {
      const client: ProviderClient =
        order.providerId === 'stub'
          ? stubClient
          : (await providerSelector.selectProviderById(order.providerId)).client;
      const result = await client.checkStatus(order.externalOrderId);
      const mappedStatus = mapProviderStatus(result.status);

      if (isTerminalStatus(mappedStatus)) {
        const completedAt = new Date();
        const remains = result.remains ?? order.remains;

        await prisma.$transaction(async (tx) => {
          const updateData: {
            status: string;
            completedAt?: Date;
            remains?: number;
          } = { status: mappedStatus, completedAt };
          if (result.remains !== undefined) updateData.remains = result.remains;

          await ordersRepo.updateOrderStatus(order.id, updateData);

          const eventType = mapTerminalEventType(mappedStatus);
          if (eventType === 'order.completed') {
            await outbox.emit(
              {
                type: 'order.completed',
                aggregateType: 'order',
                aggregateId: order.id,
                userId: order.userId,
                payload: { orderId: order.id, userId: order.userId, remains: remains ?? null },
              },
              tx,
            );
          } else if (eventType === 'order.failed') {
            await outbox.emit(
              {
                type: 'order.failed',
                aggregateType: 'order',
                aggregateId: order.id,
                userId: order.userId,
                payload: {
                  orderId: order.id,
                  userId: order.userId,
                  reason: 'resolved-via-final-check',
                },
              },
              tx,
            );
          } else if (eventType === 'order.partial') {
            await outbox.emit(
              {
                type: 'order.partial',
                aggregateType: 'order',
                aggregateId: order.id,
                userId: order.userId,
                payload: { orderId: order.id, userId: order.userId, remains: remains ?? 0 },
              },
              tx,
            );
          }
        });

        const settlementOrder = { ...order, remains: result.remains ?? order.remains };
        await fundSettlement.settleFunds(settlementOrder, mappedStatus);

        logger.info(
          { orderId: order.id, status: mappedStatus },
          'Timed-out order resolved via final check',
        );
        return mappedStatus;
      }
    } catch (err) {
      logger.warn({ orderId: order.id, err }, 'Final status check failed, will force-fail');
    }

    return null;
  }

  async function forceFailOrder(order: OrderRecord): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await ordersRepo.updateOrderStatus(order.id, {
        status: 'FAILED',
        completedAt: new Date(),
      });

      await outbox.emit(
        {
          type: 'order.failed',
          aggregateType: 'order',
          aggregateId: order.id,
          userId: order.userId,
          payload: { orderId: order.id, userId: order.userId, reason: 'timeout' },
        },
        tx,
      );
    });

    await fundSettlement.settleFunds(order, 'FAILED');

    logger.info({ orderId: order.id }, 'Order force-failed due to timeout, funds released');
  }

  async function processTimedOutOrders(): Promise<void> {
    const { orderTimeoutHours } = config;

    const timedOutOrders = await ordersRepo.findTimedOutOrders(orderTimeoutHours);
    if (timedOutOrders.length === 0) {
      logger.debug('No timed-out orders');
      return;
    }

    logger.info(
      { count: timedOutOrders.length, timeoutHours: orderTimeoutHours },
      'Processing timed-out orders',
    );

    for (const order of timedOutOrders) {
      try {
        const resolvedStatus = await attemptFinalStatusCheck(order);
        if (!resolvedStatus) {
          await forceFailOrder(order);
        }
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to process timed-out order');
      }
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker(
      QUEUE_NAME,
      async () => {
        await processTimedOutOrders();
      },
      { retryable: false, concurrency: 1 },
    );

    const q = getNamedQueue(QUEUE_NAME);
    await q.add('order-timeout-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

    logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Order timeout worker started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Order timeout worker stopped');
  }

  return { start, stop, processTimedOutOrders };
}
