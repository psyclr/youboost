import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../../shared/redis/redis';
import { createServiceLogger } from '../../../shared/utils/logger';
import { selectProviderById } from '../../providers';
import * as ordersRepo from '../orders.repository';
import * as serviceRepo from '../service.repository';
import { setRefillEligibility } from '../orders.service';
import type { OrderRecord } from '../orders.types';

const log = createServiceLogger('drip-feed-worker');

const QUEUE_NAME = 'drip-feed';
let queue: Queue | null = null;
let worker: Worker | null = null;

function getDripFeedQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
    });
  }
  return queue;
}

async function processDripFeedRun(order: OrderRecord): Promise<void> {
  if (order.dripFeedPausedAt) {
    return;
  }
  if (!order.dripFeedRuns || !order.dripFeedInterval) {
    log.warn({ orderId: order.id }, 'Drip-feed order missing runs/interval configuration');
    return;
  }

  const service = await serviceRepo.findServiceById(order.serviceId);
  if (!service || !service.providerId || !service.externalServiceId) {
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

  // Check if all runs are completed
  if (updated.dripFeedRunsCompleted >= order.dripFeedRuns) {
    // Check if service has refill guarantee
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
      // Re-throw to let BullMQ handle retry logic
      throw err;
    }
  }
}

export async function startDripFeedWorker(): Promise<void> {
  if (worker) {
    log.warn('Drip-feed worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await processDripFeedBatch();
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Drip-feed job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Drip-feed job completed');
  });

  // Schedule repeatable job every 60 seconds
  const q = getDripFeedQueue();
  await q.add('drip-feed-tick', {}, { repeat: { every: 60_000 } });

  log.info('Drip-feed worker started (interval: 60s)');
}

export async function stopDripFeedWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Drip-feed worker stopped');
}
