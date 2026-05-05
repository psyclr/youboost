import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import { createServiceLogger } from '../../../shared/utils/logger';
import { selectProviderById } from '../../providers';
import * as ordersRepo from '../orders.repository';
import * as serviceRepo from '../service.repository';
import { setRefillEligibility } from '../orders.service';
import type { OrderRecord } from '../orders.types';

const log = createServiceLogger('drip-feed-worker');

const QUEUE_NAME = 'drip-feed';

async function processDripFeedRun(order: OrderRecord): Promise<void> {
  if (order.dripFeedPausedAt) {
    return;
  }
  if (!order.dripFeedRuns || !order.dripFeedInterval) {
    log.warn({ orderId: order.id }, 'Drip-feed order missing runs/interval configuration');
    return;
  }

  const service = await serviceRepo.findServiceById(order.serviceId);
  if (!service?.providerId || !service?.externalServiceId) {
    log.error({ orderId: order.id }, 'Service not available for drip-feed run');
    return;
  }

  const chunkSize = Math.ceil(order.quantity / order.dripFeedRuns);
  const { client } = await selectProviderById(service.providerId);

  await client.submitOrder({
    serviceId: service.externalServiceId,
    link: order.link,
    quantity: chunkSize,
  });

  const updated = await ordersRepo.incrementDripFeedRun(order.id);
  log.info(
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
      await setRefillEligibility(order.id, service.refillDays);
    } else {
      await ordersRepo.updateOrderStatus(order.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        remains: 0,
      });
    }

    log.info({ orderId: order.id }, 'All drip-feed runs completed, order marked COMPLETED');
  }
}

async function processDripFeedBatch(): Promise<void> {
  const dueOrders = await ordersRepo.findDripFeedOrdersDue();
  if (dueOrders.length === 0) {
    log.debug('No drip-feed orders due');
    return;
  }

  log.info({ count: dueOrders.length }, 'Processing due drip-feed orders');

  for (const order of dueOrders) {
    try {
      await processDripFeedRun(order);
    } catch (err) {
      log.error({ orderId: order.id, err }, 'Failed to process drip-feed run');
      throw err;
    }
  }
}

export async function startDripFeedWorker(): Promise<void> {
  await startNamedWorker(
    QUEUE_NAME,
    async () => {
      await processDripFeedBatch();
    },
    { retryable: true, concurrency: 1 },
  );

  const q = getNamedQueue(QUEUE_NAME);
  await q.add('drip-feed-tick', {}, { repeat: { every: 60_000 } });

  log.info('Drip-feed worker started (interval: 60s)');
}

export async function stopDripFeedWorker(): Promise<void> {
  await stopNamedWorker(QUEUE_NAME);
  log.info('Drip-feed worker stopped');
}
