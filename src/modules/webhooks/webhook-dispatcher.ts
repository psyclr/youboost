import crypto from 'node:crypto';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../shared/queue';
import type { WebhooksRepository } from './webhooks.repository';

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

export interface WebhookDispatcher {
  enqueueWebhookDelivery(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void>;
  processWebhookDelivery(job: Job<WebhookJobData>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface WebhookDispatcherDeps {
  webhooksRepo: WebhooksRepository;
  logger: Logger;
}

export function createWebhookDispatcher(deps: WebhookDispatcherDeps): WebhookDispatcher {
  const { webhooksRepo, logger } = deps;

  async function enqueueWebhookDelivery(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const webhooks = await webhooksRepo.findActiveWebhooksByEvent(userId, event);
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

      logger.info({ userId, event, webhookCount: webhooks.length }, 'Webhook deliveries enqueued');
    } catch (err) {
      logger.error({ err, userId, event }, 'Failed to enqueue webhook deliveries');
    }
  }

  async function processWebhookDelivery(job: Job<WebhookJobData>): Promise<void> {
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

    webhooksRepo.updateLastTriggeredAt(webhookId).catch((err) => {
      logger.error({ err, webhookId }, 'Failed to update lastTriggeredAt');
    });

    logger.info({ webhookId, event, status: response.status }, 'Webhook delivered');
  }

  async function start(): Promise<void> {
    await startNamedWorker<WebhookJobData>(
      QUEUE_NAME,
      async (job) => {
        await processWebhookDelivery(job);
      },
      { retryable: true, concurrency: 3 },
    );
    logger.info('Webhook worker started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Webhook worker stopped');
  }

  return { enqueueWebhookDelivery, processWebhookDelivery, start, stop };
}
