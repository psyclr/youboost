export type { WebhooksService } from './webhooks.service';
export { createWebhooksService } from './webhooks.service';
export type { WebhooksRepository } from './webhooks.repository';
export { createWebhooksRepository } from './webhooks.repository';
export type { WebhookDispatcher } from './webhook-dispatcher';
export { createWebhookDispatcher } from './webhook-dispatcher';

// Transitional shims for unconverted callers (orders.helpers.ts, orders workers, src/index.ts).
// Delete in sweep phase F17.
import { getPrisma } from '../../shared/database';
import { createServiceLogger } from '../../shared/utils/logger';
import { createWebhooksRepository } from './webhooks.repository';
import { createWebhookDispatcher } from './webhook-dispatcher';
import type { WebhookDispatcher } from './webhook-dispatcher';

let _dispatcher: WebhookDispatcher | null = null;
function getDispatcher(): WebhookDispatcher {
  if (!_dispatcher) {
    _dispatcher = createWebhookDispatcher({
      webhooksRepo: createWebhooksRepository(getPrisma()),
      logger: createServiceLogger('webhook-dispatcher'),
    });
  }
  return _dispatcher;
}

export async function enqueueWebhookDelivery(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getDispatcher().enqueueWebhookDelivery(userId, event, data);
}

export async function startWebhookWorker(): Promise<void> {
  await getDispatcher().start();
}

export async function stopWebhookWorker(): Promise<void> {
  await getDispatcher().stop();
}
