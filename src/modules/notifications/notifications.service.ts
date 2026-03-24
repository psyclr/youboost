import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as notificationRepo from './notification.repository';
import { enqueueNotification } from './notification-dispatcher';
import type {
  SendNotificationInput,
  NotificationsQuery,
  NotificationRecord,
  PaginatedNotifications,
} from './notifications.types';

const log = createServiceLogger('notifications');

export async function sendNotification(input: SendNotificationInput): Promise<NotificationRecord> {
  const notification = await notificationRepo.createNotification({
    userId: input.userId,
    type: input.type,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    eventType: input.eventType ?? null,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
  });

  await enqueueNotification(notification.id);

  log.info({ notificationId: notification.id, userId: input.userId }, 'Notification enqueued');

  return notification;
}

export async function listNotifications(
  userId: string,
  query: NotificationsQuery,
): Promise<PaginatedNotifications> {
  const { notifications, total } = await notificationRepo.findNotificationsByUserId(userId, {
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      subject: n.subject,
      status: n.status,
      eventType: n.eventType,
      createdAt: n.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getNotification(
  notificationId: string,
  userId: string,
): Promise<NotificationRecord> {
  const notification = await notificationRepo.findNotificationById(notificationId, userId);
  if (!notification) {
    throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  return notification;
}
