import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { NotificationsService } from '../notifications.service';

interface HandlerDeps {
  notificationsService: NotificationsService;
  logger: Logger;
}

export function createDepositConfirmedEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'deposit.confirmed'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'deposit.confirmed',
    name: 'deposit-confirmed-email',
    async handle(event): Promise<void> {
      logger.debug({ depositId: event.payload.depositId }, 'sending deposit.confirmed email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Deposit Confirmed',
        body: `Your ${event.payload.provider} deposit of $${event.payload.amount.toFixed(2)} has been confirmed.`,
        eventType: 'deposit.confirmed',
        referenceType: 'deposit',
        referenceId: event.payload.depositId,
      });
    },
  };
}

export function createDepositFailedEmailHandler(
  deps: HandlerDeps,
): OutboxHandler<'deposit.failed'> {
  const { notificationsService, logger } = deps;
  return {
    eventType: 'deposit.failed',
    name: 'deposit-failed-email',
    async handle(event): Promise<void> {
      logger.debug({ depositId: event.payload.depositId }, 'sending deposit.failed email');
      await notificationsService.sendNotification({
        userId: event.userId,
        type: 'EMAIL',
        channel: 'user-email',
        subject: 'Deposit Failed',
        body: `Your deposit ${event.payload.depositId} failed: ${event.payload.reason}.`,
        eventType: 'deposit.failed',
        referenceType: 'deposit',
        referenceId: event.payload.depositId,
      });
    },
  };
}
