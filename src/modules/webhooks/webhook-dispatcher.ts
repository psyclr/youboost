import crypto from 'node:crypto';
import type { Job } from 'bullmq';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../shared/queue';
import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './webhooks.repository';

const log = createServiceLogger('webhook-dispatcher');

const QUEUE_NAME = 'webhook-delivery';

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
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

    const q = getNamedQueue(QUEUE_NAME);

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

  repo.updateLastTriggeredAt(webhookId).catch((err) => {
    log.error({ err, webhookId }, 'Failed to update lastTriggeredAt');
  });

  log.info({ webhookId, event, status: response.status }, 'Webhook delivered');
}

export async function startWebhookWorker(): Promise<void> {
  await startNamedWorker<WebhookJobData>(
    QUEUE_NAME,
    async (job) => {
      await processWebhookDelivery(job);
    },
    { retryable: true, concurrency: 3 },
  );
  log.info('Webhook worker started');
}

export async function stopWebhookWorker(): Promise<void> {
  await stopNamedWorker(QUEUE_NAME);
  log.info('Webhook worker stopped');
}
