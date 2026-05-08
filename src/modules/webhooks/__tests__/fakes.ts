import type { WebhooksRepository } from '../webhooks.repository';
import type { WebhookRecord } from '../webhooks.types';

export type CreateWebhookData = {
  userId: string;
  url: string;
  events: string[];
  secret: string;
};

export type UpdateWebhookData = {
  url?: string;
  events?: string[];
  isActive?: boolean;
};

export type WebhookFilters = {
  isActive?: boolean;
  page: number;
  limit: number;
};

export type FakeWebhooksRepository = WebhooksRepository & {
  calls: {
    createWebhook: CreateWebhookData[];
    findWebhooksByUserId: Array<{ userId: string; filters: WebhookFilters }>;
    findWebhookById: Array<{ webhookId: string; userId: string }>;
    updateWebhook: Array<{ webhookId: string; userId: string; data: UpdateWebhookData }>;
    deleteWebhook: Array<{ webhookId: string; userId: string }>;
    findActiveWebhooksByEvent: Array<{ userId: string; event: string }>;
    updateLastTriggeredAt: string[];
  };
  store: Map<string, WebhookRecord>;
  setFindActiveWebhooksByEventFailure: (err: Error | null) => void;
  setUpdateLastTriggeredAtFailure: (err: Error | null) => void;
};

export function createFakeWebhooksRepository(
  seed: { webhooks?: WebhookRecord[] } = {},
): FakeWebhooksRepository {
  const store = new Map<string, WebhookRecord>((seed.webhooks ?? []).map((w) => [w.id, w]));
  let idCounter = store.size + 1;

  const calls: FakeWebhooksRepository['calls'] = {
    createWebhook: [],
    findWebhooksByUserId: [],
    findWebhookById: [],
    updateWebhook: [],
    deleteWebhook: [],
    findActiveWebhooksByEvent: [],
    updateLastTriggeredAt: [],
  };

  let findActiveWebhooksByEventFailure: Error | null = null;
  let updateLastTriggeredAtFailure: Error | null = null;

  return {
    async createWebhook(data) {
      calls.createWebhook.push(data);
      const id = `wh-${idCounter++}`;
      const record: WebhookRecord = {
        id,
        userId: data.userId,
        url: data.url,
        events: data.events,
        secret: data.secret,
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
      store.set(id, record);
      return record;
    },
    async findWebhooksByUserId(userId, filters) {
      calls.findWebhooksByUserId.push({ userId, filters });
      const all = [...store.values()].filter((w) => {
        if (w.userId !== userId) return false;
        if (filters.isActive !== undefined && w.isActive !== filters.isActive) return false;
        return true;
      });
      const total = all.length;
      const start = (filters.page - 1) * filters.limit;
      const webhooks = all.slice(start, start + filters.limit);
      return { webhooks, total };
    },
    async findWebhookById(webhookId, userId) {
      calls.findWebhookById.push({ webhookId, userId });
      const rec = store.get(webhookId);
      if (!rec) return null;
      if (rec.userId !== userId) return null;
      return rec;
    },
    async updateWebhook(webhookId, userId, data) {
      calls.updateWebhook.push({ webhookId, userId, data });
      const existing = store.get(webhookId);
      if (!existing || existing.userId !== userId) {
        throw new Error('Webhook not found');
      }
      const updated: WebhookRecord = {
        ...existing,
        ...(data.url === undefined ? {} : { url: data.url }),
        ...(data.events === undefined ? {} : { events: data.events }),
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      };
      store.set(webhookId, updated);
      return updated;
    },
    async deleteWebhook(webhookId, userId) {
      calls.deleteWebhook.push({ webhookId, userId });
      const existing = store.get(webhookId);
      if (!existing || existing.userId !== userId) {
        throw new Error('Webhook not found');
      }
      store.delete(webhookId);
    },
    async findActiveWebhooksByEvent(userId, event) {
      calls.findActiveWebhooksByEvent.push({ userId, event });
      if (findActiveWebhooksByEventFailure) throw findActiveWebhooksByEventFailure;
      return [...store.values()].filter(
        (w) => w.userId === userId && w.isActive && w.events.includes(event),
      );
    },
    async updateLastTriggeredAt(webhookId) {
      calls.updateLastTriggeredAt.push(webhookId);
      if (updateLastTriggeredAtFailure) throw updateLastTriggeredAtFailure;
      const existing = store.get(webhookId);
      if (!existing) return;
      store.set(webhookId, { ...existing, lastTriggeredAt: new Date() });
    },
    calls,
    store,
    setFindActiveWebhooksByEventFailure(err) {
      findActiveWebhooksByEventFailure = err;
    },
    setUpdateLastTriggeredAtFailure(err) {
      updateLastTriggeredAtFailure = err;
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
