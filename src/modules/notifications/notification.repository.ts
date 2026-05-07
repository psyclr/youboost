import { getPrisma } from '../../shared/database';
import type { NotificationStatus, PrismaClient } from '../../generated/prisma';
import type { NotificationRecord } from './notifications.types';

export interface NotificationRepository {
  createNotification(data: {
    userId: string;
    type: 'EMAIL';
    channel: string;
    subject: string;
    body: string;
    eventType?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
  }): Promise<NotificationRecord>;
  findNotificationsByUserId(
    userId: string,
    filters: { status?: NotificationStatus | undefined; page: number; limit: number },
  ): Promise<{ notifications: NotificationRecord[]; total: number }>;
  findNotificationById(id: string, userId?: string | undefined): Promise<NotificationRecord | null>;
  updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    failureReason?: string | null,
  ): Promise<NotificationRecord>;
  incrementRetryCount(id: string): Promise<NotificationRecord>;
}

export function createNotificationRepository(prisma: PrismaClient): NotificationRepository {
  async function createNotification(data: {
    userId: string;
    type: 'EMAIL';
    channel: string;
    subject: string;
    body: string;
    eventType?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
  }): Promise<NotificationRecord> {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        channel: data.channel,
        subject: data.subject,
        body: data.body,
        status: 'PENDING',
        eventType: data.eventType ?? null,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
      },
    });
  }

  async function findNotificationsByUserId(
    userId: string,
    filters: { status?: NotificationStatus | undefined; page: number; limit: number },
  ): Promise<{ notifications: NotificationRecord[]; total: number }> {
    const where: { userId: string; status?: NotificationStatus } = { userId };
    if (filters.status) {
      where.status = filters.status;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  async function findNotificationById(
    id: string,
    userId?: string | undefined,
  ): Promise<NotificationRecord | null> {
    const where: { id: string; userId?: string } = { id };
    if (userId) {
      where.userId = userId;
    }
    return prisma.notification.findFirst({ where });
  }

  async function updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    failureReason?: string | null,
  ): Promise<NotificationRecord> {
    const data: { status: NotificationStatus; sentAt?: Date; failureReason?: string | null } = {
      status,
    };
    if (status === 'SENT') {
      data.sentAt = new Date();
    }
    if (failureReason !== undefined) {
      data.failureReason = failureReason;
    }
    return prisma.notification.update({ where: { id }, data });
  }

  async function incrementRetryCount(id: string): Promise<NotificationRecord> {
    return prisma.notification.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
    });
  }

  return {
    createNotification,
    findNotificationsByUserId,
    findNotificationById,
    updateNotificationStatus,
    incrementRetryCount,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createNotification(data: {
  userId: string;
  type: 'EMAIL';
  channel: string;
  subject: string;
  body: string;
  eventType?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}): Promise<NotificationRecord> {
  return createNotificationRepository(getPrisma()).createNotification(data);
}

export async function findNotificationsByUserId(
  userId: string,
  filters: { status?: NotificationStatus | undefined; page: number; limit: number },
): Promise<{ notifications: NotificationRecord[]; total: number }> {
  return createNotificationRepository(getPrisma()).findNotificationsByUserId(userId, filters);
}

export async function findNotificationById(
  id: string,
  userId?: string | undefined,
): Promise<NotificationRecord | null> {
  return createNotificationRepository(getPrisma()).findNotificationById(id, userId);
}

export async function updateNotificationStatus(
  id: string,
  status: NotificationStatus,
  failureReason?: string | null,
): Promise<NotificationRecord> {
  return createNotificationRepository(getPrisma()).updateNotificationStatus(
    id,
    status,
    failureReason,
  );
}

export async function incrementRetryCount(id: string): Promise<NotificationRecord> {
  return createNotificationRepository(getPrisma()).incrementRetryCount(id);
}
