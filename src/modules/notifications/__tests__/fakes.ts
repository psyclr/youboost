import type { NotificationRepository } from '../notification.repository';
import type { EmailProvider } from '../utils/email-provider';
import type { NotificationStatus } from '../../../generated/prisma';
import type { NotificationRecord } from '../notifications.types';

export type CreateNotificationData = {
  userId: string;
  type: 'EMAIL';
  channel: string;
  subject: string;
  body: string;
  eventType?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
};

export type FakeNotificationRepository = NotificationRepository & {
  calls: {
    createNotification: CreateNotificationData[];
    findNotificationsByUserId: Array<{
      userId: string;
      filters: { status?: NotificationStatus | undefined; page: number; limit: number };
    }>;
    findNotificationById: Array<{ id: string; userId?: string | undefined }>;
    updateNotificationStatus: Array<{
      id: string;
      status: NotificationStatus;
      failureReason?: string | null | undefined;
    }>;
    incrementRetryCount: string[];
  };
  store: Map<string, NotificationRecord>;
};

export function createFakeNotificationRepository(
  seed: { notifications?: NotificationRecord[] } = {},
): FakeNotificationRepository {
  const store = new Map<string, NotificationRecord>(
    (seed.notifications ?? []).map((n) => [n.id, n]),
  );
  let idCounter = store.size + 1;

  const calls: FakeNotificationRepository['calls'] = {
    createNotification: [],
    findNotificationsByUserId: [],
    findNotificationById: [],
    updateNotificationStatus: [],
    incrementRetryCount: [],
  };

  return {
    async createNotification(data) {
      calls.createNotification.push(data);
      const id = `notif-${idCounter++}`;
      const record: NotificationRecord = {
        id,
        userId: data.userId,
        type: data.type,
        channel: data.channel,
        subject: data.subject,
        body: data.body,
        status: 'PENDING',
        eventType: data.eventType ?? null,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        sentAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      store.set(id, record);
      return record;
    },
    async findNotificationsByUserId(userId, filters) {
      calls.findNotificationsByUserId.push({ userId, filters });
      const all = [...store.values()].filter(
        (n) => n.userId === userId && (!filters.status || n.status === filters.status),
      );
      const total = all.length;
      const start = (filters.page - 1) * filters.limit;
      const notifications = all.slice(start, start + filters.limit);
      return { notifications, total };
    },
    async findNotificationById(id, userId) {
      calls.findNotificationById.push({ id, userId });
      const rec = store.get(id);
      if (!rec) return null;
      if (userId && rec.userId !== userId) return null;
      return rec;
    },
    async updateNotificationStatus(id, status, failureReason) {
      calls.updateNotificationStatus.push({ id, status, failureReason });
      const existing = store.get(id);
      if (!existing) throw new Error(`Notification ${id} not found`);
      const updated: NotificationRecord = {
        ...existing,
        status,
        sentAt: status === 'SENT' ? new Date() : existing.sentAt,
        failureReason: failureReason === undefined ? existing.failureReason : failureReason,
      };
      store.set(id, updated);
      return updated;
    },
    async incrementRetryCount(id) {
      calls.incrementRetryCount.push(id);
      const existing = store.get(id);
      if (!existing) throw new Error(`Notification ${id} not found`);
      const updated: NotificationRecord = { ...existing, retryCount: existing.retryCount + 1 };
      store.set(id, updated);
      return updated;
    },
    calls,
    store,
  };
}

export type FakeEmailProvider = EmailProvider & {
  sent: Array<{ to: string; subject: string; body: string }>;
  setFailure: (err: Error | null) => void;
};

export function createFakeEmailProvider(): FakeEmailProvider {
  const sent: Array<{ to: string; subject: string; body: string }> = [];
  let failure: Error | null = null;
  return {
    async send(params) {
      if (failure) throw failure;
      sent.push(params);
    },
    sent,
    setFailure(err) {
      failure = err;
    },
  };
}

export type FakeEnqueue = {
  fn: (id: string) => Promise<void>;
  ids: string[];
  setFailure: (err: Error | null) => void;
};

export function createFakeEnqueue(): FakeEnqueue {
  const ids: string[] = [];
  let failure: Error | null = null;
  return {
    async fn(id: string): Promise<void> {
      if (failure) throw failure;
      ids.push(id);
    },
    ids,
    setFailure(err) {
      failure = err;
    },
  };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
