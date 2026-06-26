import type { Logger } from 'pino';
import type { OutboxHandler } from '../../../shared/outbox';
import type { EmailProvider } from '../utils/email-provider';

interface AdminAlertHandlerDeps {
  emailProvider: EmailProvider;
  /** Where ops alerts go. When unset, alerts are logged but not emailed. */
  adminEmail: string | undefined;
  logger: Logger;
}

/**
 * Notify the admin when an order exhausts every panel (the customer keeps seeing
 * "In progress"; failures are an ops concern). No-op email when ADMIN_ALERT_EMAIL
 * is unset — the event is still logged. Sends via the email provider directly
 * (an ops alert, not a per-user notification).
 */
export function createAdminFulfilmentExhaustedHandler(
  deps: AdminAlertHandlerDeps,
): OutboxHandler<'order.fulfilment_exhausted'> {
  const { emailProvider, adminEmail, logger } = deps;
  return {
    eventType: 'order.fulfilment_exhausted',
    name: 'admin-fulfilment-exhausted',
    async handle(event): Promise<void> {
      const { orderId, userId, attempts } = event.payload;
      if (!adminEmail) {
        logger.warn(
          { orderId, attempts },
          'Order fulfilment exhausted — no ADMIN_ALERT_EMAIL configured, email skipped',
        );
        return;
      }
      await emailProvider.send({
        to: adminEmail,
        subject: `[YouBoost] Order ${orderId.slice(0, 8)} needs attention — all panels failed`,
        body: `Order ${orderId} (user ${userId}) could not be fulfilled after ${attempts} panel attempt(s). The customer has paid and still sees "In progress". Resolve by retrying on another panel or refunding from admin.`,
      });
      logger.info({ orderId, attempts }, 'Admin alerted: order fulfilment exhausted');
    },
  };
}
