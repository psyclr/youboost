export type { NotificationsService } from './notifications.service';
export { createNotificationsService } from './notifications.service';
export type { NotificationRepository } from './notification.repository';
export { createNotificationRepository } from './notification.repository';
export type { NotificationDispatcher } from './notification-dispatcher';
export { createNotificationDispatcher } from './notification-dispatcher';
export { getEmailProvider } from './utils/email-provider-factory';
export type { EmailProvider } from './utils/email-provider';
export { verificationEmail, passwordResetEmail } from './utils/email-templates';

export {
  createOrderCreatedEmailHandler,
  createOrderCancelledEmailHandler,
  createOrderCompletedEmailHandler,
  createOrderFailedEmailHandler,
  createOrderPartialEmailHandler,
} from './handlers/order-email.handler';
export {
  createDepositConfirmedEmailHandler,
  createDepositFailedEmailHandler,
} from './handlers/deposit-email.handler';
