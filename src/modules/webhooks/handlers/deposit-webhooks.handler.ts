import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { WebhookDispatcher } from '../webhook-dispatcher';

interface HandlerDeps {
  webhookDispatcher: WebhookDispatcher;
  logger: Logger;
}

export function createDepositConfirmedWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'deposit.confirmed'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'deposit.confirmed',
    name: 'deposit-confirmed-webhook',
    async handle(event): Promise<void> {
      logger.debug({ depositId: event.payload.depositId }, 'dispatching deposit.confirmed webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'deposit.confirmed',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}

export function createDepositFailedWebhookHandler(
  deps: HandlerDeps,
): OutboxHandler<'deposit.failed'> {
  const { webhookDispatcher, logger } = deps;
  return {
    eventType: 'deposit.failed',
    name: 'deposit-failed-webhook',
    async handle(event): Promise<void> {
      logger.debug({ depositId: event.payload.depositId }, 'dispatching deposit.failed webhook');
      await webhookDispatcher.enqueueWebhookDelivery(
        event.userId,
        'deposit.failed',
        event.payload as unknown as Record<string, unknown>,
      );
    },
  };
}
