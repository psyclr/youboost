import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { WebhookDispatcher } from '../webhook-dispatcher';

interface HandlerDeps {
  webhookDispatcher: WebhookDispatcher;
  logger: Logger;
}

export function createOrderCreatedWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.created'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'order.created',
    name: 'order-created-webhook',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'dispatching order.created webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'order.created',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createOrderCancelledWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.cancelled'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'order.cancelled',
    name: 'order-cancelled-webhook',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'dispatching order.cancelled webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'order.cancelled',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createOrderCompletedWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.completed'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'order.completed',
    name: 'order-completed-webhook',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'dispatching order.completed webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'order.completed',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createOrderFailedWebhookHandler(deps: HandlerDeps): OutboxHandler<'order.failed'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'order.failed',
    name: 'order-failed-webhook',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'dispatching order.failed webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'order.failed',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createOrderPartialWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'order.partial'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'order.partial',
    name: 'order-partial-webhook',
    async handle(event): Promise<void> {
      logger.debug({ orderId: event.payload.orderId }, 'dispatching order.partial webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'order.partial',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}
