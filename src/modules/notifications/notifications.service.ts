import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import type { NotificationRepository } from './notification.repository';
import type {
  SendNotificationInput,
  NotificationsQuery,
  NotificationRecord,
  PaginatedNotifications,
} from './notifications.types';

export interface NotificationsService {
  sendNotification(input: SendNotificationInput): Promise<NotificationRecord>;
  listNotifications(userId: string, query: NotificationsQuery): Promise<PaginatedNotifications>;
  getNotification(notificationId: string, userId: string): Promise<NotificationRecord>;
}

export interface NotificationsServiceDeps {
  notificationRepo: NotificationRepository;
  enqueueNotificationJob: (notificationId: string) => Promise<void>;
  logger: Logger;
}

export function createNotificationsService(deps: NotificationsServiceDeps): NotificationsService {
  const { notificationRepo, enqueueNotificationJob, logger } = deps;

  async function sendNotification(input: SendNotificationInput): Promise<NotificationRecord> {
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

    await enqueueNotificationJob(notification.id);

    logger.info({ notificationId: notification.id, userId: input.userId }, 'Notification enqueued');

    return notification;
  }

  async function listNotifications(
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

  async function getNotification(
    notificationId: string,
    userId: string,
  ): Promise<NotificationRecord> {
    const notification = await notificationRepo.findNotificationById(notificationId, userId);
    if (!notification) {
      throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }
    return notification;
  }

  return { sendNotification, listNotifications, getNotification };
}
