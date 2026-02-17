import { getPrisma } from '../../shared/database';
import type { NotificationStatus } from '../../generated/prisma';
import type { NotificationRecord } from './notifications.types';

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
  const prisma = getPrisma();
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

export async function findNotificationsByUserId(
  userId: string,
  filters: { status?: NotificationStatus | undefined; page: number; limit: number },
): Promise<{ notifications: NotificationRecord[]; total: number }> {
  const prisma = getPrisma();
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

export async function findNotificationById(
  id: string,
  userId?: string | undefined,
): Promise<NotificationRecord | null> {
  const prisma = getPrisma();
  const where: { id: string; userId?: string } = { id };
  if (userId) {
    where.userId = userId;
  }
  return prisma.notification.findFirst({ where });
}

export async function updateNotificationStatus(
  id: string,
  status: NotificationStatus,
  failureReason?: string | null,
): Promise<NotificationRecord> {
  const prisma = getPrisma();
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

export async function incrementRetryCount(id: string): Promise<NotificationRecord> {
  const prisma = getPrisma();
  return prisma.notification.update({
    where: { id },
    data: { retryCount: { increment: 1 } },
  });
}
