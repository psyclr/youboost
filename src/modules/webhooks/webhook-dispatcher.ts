import crypto from 'node:crypto';
import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from '../../shared/redis/redis';
import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './webhooks.repository';

const log = createServiceLogger('webhook-dispatcher');

const QUEUE_NAME = 'webhook-delivery';
let queue: Queue | null = null;
let worker: Worker | null = null;

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function getWebhookQueue(): Queue {
  queue ??= new Queue(QUEUE_NAME, {
    connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
  });
  return queue;
}

export interface WebhookJobData {
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

export async function enqueueWebhookDelivery(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const webhooks = await repo.findActiveWebhooksByEvent(userId, event);
    if (webhooks.length === 0) return;

    const q = getWebhookQueue();

    for (const webhook of webhooks) {
      const jobData: WebhookJobData = {
        webhookId: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        event,
        payload: { event, data, timestamp: new Date().toISOString() },
      };

      await q.add(`deliver:${event}`, jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      });
    }

    log.info({ userId, event, webhookCount: webhooks.length }, 'Webhook deliveries enqueued');
  } catch (err) {
    log.error({ err, userId, event }, 'Failed to enqueue webhook deliveries');
  }
}

export async function processWebhookDelivery(job: Job<WebhookJobData>): Promise<void> {
  const { webhookId, url, secret, event, payload } = job.data;
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }

  // Fire-and-forget lastTriggeredAt update
  repo.updateLastTriggeredAt(webhookId).catch((err) => {
    log.error({ err, webhookId }, 'Failed to update lastTriggeredAt');
  });

  log.info({ webhookId, event, status: response.status }, 'Webhook delivered');
}

export async function startWebhookWorker(): Promise<void> {
  if (worker) {
    log.warn('Webhook worker already started');
    return;
  }

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      log.debug(
        { jobName: job.name, webhookId: job.data.webhookId },
        'Processing webhook delivery',
      );
      await processWebhookDelivery(job);
    },
    {
      connection: getRedis().duplicate({ maxRetriesPerRequest: null }),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobName: job?.name, err }, 'Webhook delivery job failed');
  });

  worker.on('completed', (job) => {
    log.debug({ jobName: job.name }, 'Webhook delivery job completed');
  });

  log.info('Webhook worker started');
}

export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  log.info('Webhook worker stopped');
}
