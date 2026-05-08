import type { Logger } from 'pino';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import type { ProviderSelectorPort } from '../ports/provider-selector.port';
import type { OrdersService } from '../orders.service';
import type { OrdersRepository } from '../orders.repository';
import type { ServicesRepository } from '../service.repository';
import type { OrderRecord } from '../orders.types';

const QUEUE_NAME = 'drip-feed';
const TICK_INTERVAL_MS = 60_000;

export interface DripFeedWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Exposed for tests — process a single batch synchronously. */
  processDripFeedBatch(): Promise<void>;
}

export interface DripFeedWorkerDeps {
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  providerSelector: ProviderSelectorPort;
  ordersService: Pick<OrdersService, 'setRefillEligibility'>;
  logger: Logger;
}

export function createDripFeedWorker(deps: DripFeedWorkerDeps): DripFeedWorker {
  const { ordersRepo, servicesRepo, providerSelector, ordersService, logger } = deps;

  async function processDripFeedRun(order: OrderRecord): Promise<void> {
    if (order.dripFeedPausedAt) {
      return;
    }
    if (!order.dripFeedRuns || !order.dripFeedInterval) {
      logger.warn({ orderId: order.id }, 'Drip-feed order missing runs/interval configuration');
      return;
    }

    const service = await servicesRepo.findServiceById(order.serviceId);
    if (!service?.providerId || !service?.externalServiceId) {
      logger.error({ orderId: order.id }, 'Service not available for drip-feed run');
      return;
    }

    const chunkSize = Math.ceil(order.quantity / order.dripFeedRuns);
    const { client } = await providerSelector.selectProviderById(service.providerId);

    await client.submitOrder({
      serviceId: service.externalServiceId,
      link: order.link,
      quantity: chunkSize,
    });

    const updated = await ordersRepo.incrementDripFeedRun(order.id);
    logger.info(
      {
        orderId: order.id,
        run: updated.dripFeedRunsCompleted,
        totalRuns: order.dripFeedRuns,
        chunkSize,
      },
      'Drip-feed run submitted',
    );

    if (updated.dripFeedRunsCompleted >= order.dripFeedRuns) {
      if (service.refillDays) {
        await ordersService.setRefillEligibility(order.id, service.refillDays);
      } else {
        await ordersRepo.updateOrderStatus(order.id, {
          status: 'COMPLETED',
          completedAt: new Date(),
          remains: 0,
        });
      }

      logger.info({ orderId: order.id }, 'All drip-feed runs completed, order marked COMPLETED');
    }
  }

  async function processDripFeedBatch(): Promise<void> {
    const dueOrders = await ordersRepo.findDripFeedOrdersDue();
    if (dueOrders.length === 0) {
      logger.debug('No drip-feed orders due');
      return;
    }

    logger.info({ count: dueOrders.length }, 'Processing due drip-feed orders');

    for (const order of dueOrders) {
      try {
        await processDripFeedRun(order);
      } catch (err) {
        logger.error({ orderId: order.id, err }, 'Failed to process drip-feed run');
        throw err;
      }
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker(
      QUEUE_NAME,
      async () => {
        await processDripFeedBatch();
      },
      { retryable: true, concurrency: 1 },
    );

    const q = getNamedQueue(QUEUE_NAME);
    await q.add('drip-feed-tick', {}, { repeat: { every: TICK_INTERVAL_MS } });

    logger.info('Drip-feed worker started (interval: 60s)');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Drip-feed worker stopped');
  }

  return { start, stop, processDripFeedBatch };
}
