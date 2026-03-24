import { z } from 'zod/v4';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
});

export const notificationIdSchema = z.object({
  notificationId: z.uuid(),
});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationIdParam = z.infer<typeof notificationIdSchema>;

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  eventType: string | null;
  referenceType: string | null;
  referenceId: string | null;
  sentAt: Date | null;
  failureReason: string | null;
  retryCount: number;
  createdAt: Date;
}

export interface SendNotificationInput {
  userId: string;
  type: 'EMAIL';
  channel: string;
  subject: string;
  body: string;
  eventType?: string | undefined;
  referenceType?: string | undefined;
  referenceId?: string | undefined;
}

export interface NotificationSummary {
  id: string;
  type: string;
  channel: string;
  subject: string | null;
  status: string;
  eventType: string | null;
  createdAt: Date;
}

export interface PaginatedNotifications {
  notifications: NotificationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
