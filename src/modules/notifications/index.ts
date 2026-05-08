export type { NotificationsService } from './notifications.service';
export { createNotificationsService } from './notifications.service';
export type { NotificationRepository } from './notification.repository';
export { createNotificationRepository } from './notification.repository';
export type { NotificationDispatcher } from './notification-dispatcher';
export { createNotificationDispatcher } from './notification-dispatcher';
export { getEmailProvider } from './utils/email-provider-factory';
export { verificationEmail, passwordResetEmail } from './utils/email-templates';

// Transitional shims for unconverted callers. Delete in sweep phase (F17).
import { getPrisma } from '../../shared/database';
import { createServiceLogger } from '../../shared/utils/logger';
import { createNotificationRepository } from './notification.repository';
import { createNotificationDispatcher } from './notification-dispatcher';
import { createNotificationsService } from './notifications.service';
import { getEmailProvider } from './utils/email-provider-factory';
import type { NotificationDispatcher } from './notification-dispatcher';
import type { NotificationsService } from './notifications.service';
import type { SendNotificationInput, NotificationRecord } from './notifications.types';

let _dispatcher: NotificationDispatcher | null = null;
function getDispatcher(): NotificationDispatcher {
  if (!_dispatcher) {
    _dispatcher = createNotificationDispatcher({
      notificationRepo: createNotificationRepository(getPrisma()),
      emailProvider: getEmailProvider(),
      logger: createServiceLogger('notification-dispatcher'),
    });
  }
  return _dispatcher;
}

let _service: NotificationsService | null = null;
function getService(): NotificationsService {
  if (!_service) {
    _service = createNotificationsService({
      notificationRepo: createNotificationRepository(getPrisma()),
      enqueueNotificationJob: (id) => getDispatcher().enqueueNotification(id),
      logger: createServiceLogger('notifications'),
    });
  }
  return _service;
}

export async function enqueueNotification(
  input: SendNotificationInput,
): Promise<NotificationRecord> {
  return getService().sendNotification(input);
}
export async function startNotificationWorker(): Promise<void> {
  await getDispatcher().start();
}
export async function stopNotificationWorker(): Promise<void> {
  await getDispatcher().stop();
}
