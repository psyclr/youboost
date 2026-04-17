import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../../shared/redis/redis';
import { getConfig } from '../../../shared/config';
import { createServiceLogger } from '../../../shared/utils/logger';
import * as ordersRepo from '../orders.repository';
import { settleFunds } from '../utils/fund-settlement';
import { enqueueWebhookDelivery } from '../../webhooks';
import { enqueueNotification } from '../../notifications';
import { findProviderById } from '../../providers/providers.repository';
import { decryptApiKey } from '../../providers/utils/encryption';
import { createSmmApiClient } from '../../providers/utils/smm-api-client';
import { providerClient as stubClient } from '../utils/stub-provider-client';
import { mapProviderStatus, isTerminalStatus } from '../utils/status-mapper';
import type { OrderRecord } from '../orders.types';

const log = createServiceLogger('order-timeout');

const QUEUE_NAME = 'order-timeout';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let queue: Queue | null = null;
let worker: Worker | null = null;

function getTimeoutQueue(): Queue {
  queue ??= new Queue(QUEUE_NAME, {
    connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
  });
  return queue;
}

async function attemptFinalStatusCheck(order: OrderRecord): Promise<string | null> {
  if (!order.externalOrderId || !order.providerId) return null;

  try {
    let client;
    if (order.providerId === 'stub') {
      client = stubClient;
    } else {
      const provider = await findProviderById(order.providerId);
      if (!provider) return null;
      const apiKey = decryptApiKey(provider.apiKeyEncrypted);
      client = createSmmApiClient({ apiEndpoint: provider.apiEndpoint, apiKey });
    }

    const result = await client.checkStatus(order.externalOrderId);
    const mappedStatus = mapProviderStatus(result.status);

    if (isTerminalStatus(mappedStatus)) {
      const updateData: { status: string; completedAt?: Date; remains?: number } = {
        status: mappedStatus,
        completedAt: new Date(),
      };
      if (result.remains !== undefined) updateData.remains = result.remains;
      await ordersRepo.updateOrderStatus(order.id, updateData);

      const updatedOrder = { ...order, remains: result.remains ?? order.remains };
      await settleFunds(updatedOrder, mappedStatus);

      log.info(
        { orderId: order.id, status: mappedStatus },
        'Timed-out order resolved via final check',
      );
      return mappedStatus;
    }
  } catch (err) {
    log.warn({ orderId: order.id, err }, 'Final status check failed, will force-fail');
  }

  return null;
}

async function forceFailOrder(order: OrderRecord): Promise<void> {
  await ordersRepo.updateOrderStatus(order.id, {
    status: 'FAILED',
    completedAt: new Date(),
  });

  const updatedOrder = { ...order, remains: order.remains };
  await settleFunds(updatedOrder, 'FAILED');

  enqueueWebhookDelivery(order.userId, 'order.failed', {
    orderId: order.id,
    status: 'FAILED',
    reason: 'timeout',
  }).catch(() => {});

  enqueueNotification({
    userId: order.userId,
    type: 'EMAIL',
    channel: 'user-email',
    subject: 'Order Timed Out',
    body: `Your order ${order.id} has been marked as failed due to timeout. Funds have been released back to your balance.`,
    eventType: 'order.failed',
    referenceType: 'order',
    referenceId: order.id,
  }).catch(() => {});

  log.info({ orderId: order.id }, 'Order force-failed due to timeout, funds released');
}

export async function processTimedOutOrders(): Promise<void> {
  const config = getConfig();
  const { orderTimeoutHours } = config.polling;

  const timedOutOrders = await ordersRepo.findTimedOutOrders(orderTimeoutHours);
  if (timedOutOrders.length === 0) {
    log.debug('No timed-out orders');
    return;
  }

  log.info(
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
      log.error({ orderId: order.id, err }, 'Failed to process timed-out order');
    }
  }
}

export async function startOrderTimeoutWorker(): Promise<void> {
  if (worker) {
    log.warn('Order timeout worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      await processTimedOutOrders();
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Order timeout job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Order timeout job completed');
  });

  const q = getTimeoutQueue();
  await q.add('order-timeout-tick', {}, { repeat: { every: CHECK_INTERVAL_MS } });

  log.info({ intervalMs: CHECK_INTERVAL_MS }, 'Order timeout worker started');
}

export async function stopOrderTimeoutWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Order timeout worker stopped');
}
