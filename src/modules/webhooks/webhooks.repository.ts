import type { PrismaClient } from '../../generated/prisma';
import type { WebhookRecord } from './webhooks.types';

interface CreateWebhookData {
  userId: string;
  url: string;
  events: string[];
  secret: string;
}

interface UpdateWebhookData {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

interface WebhookFilters {
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface WebhooksRepository {
  createWebhook(data: CreateWebhookData): Promise<WebhookRecord>;
  findWebhooksByUserId(
    userId: string,
    filters: WebhookFilters,
  ): Promise<{ webhooks: WebhookRecord[]; total: number }>;
  findWebhookById(webhookId: string, userId: string): Promise<WebhookRecord | null>;
  updateWebhook(webhookId: string, userId: string, data: UpdateWebhookData): Promise<WebhookRecord>;
  deleteWebhook(webhookId: string, userId: string): Promise<void>;
  findActiveWebhooksByEvent(userId: string, event: string): Promise<WebhookRecord[]>;
  updateLastTriggeredAt(webhookId: string): Promise<void>;
}

export function createWebhooksRepository(prisma: PrismaClient): WebhooksRepository {
  async function createWebhook(data: CreateWebhookData): Promise<WebhookRecord> {
    return prisma.webhook.create({
      data: {
        userId: data.userId,
        url: data.url,
        events: data.events,
        secret: data.secret,
      },
    });
  }

  async function findWebhooksByUserId(
    userId: string,
    filters: WebhookFilters,
  ): Promise<{ webhooks: WebhookRecord[]; total: number }> {
    const where: Record<string, unknown> = { userId };
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.webhook.count({ where }),
    ]);

    return { webhooks, total };
  }

  async function findWebhookById(webhookId: string, userId: string): Promise<WebhookRecord | null> {
    return prisma.webhook.findFirst({ where: { id: webhookId, userId } });
  }

  async function updateWebhook(
    webhookId: string,
    userId: string,
    data: UpdateWebhookData,
  ): Promise<WebhookRecord> {
    const updateData: Record<string, unknown> = {};

    if (data.url !== undefined) updateData.url = data.url;
    if (data.events !== undefined) updateData.events = data.events;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Use findFirst + update pattern to scope by userId
    const existing = await prisma.webhook.findFirst({ where: { id: webhookId, userId } });
    if (!existing) {
      throw new Error('Webhook not found');
    }

    return prisma.webhook.update({
      where: { id: webhookId },
      data: updateData,
    });
  }

  async function deleteWebhook(webhookId: string, userId: string): Promise<void> {
    const existing = await prisma.webhook.findFirst({ where: { id: webhookId, userId } });
    if (!existing) {
      throw new Error('Webhook not found');
    }
    await prisma.webhook.delete({ where: { id: webhookId } });
  }

  async function findActiveWebhooksByEvent(
    userId: string,
    event: string,
  ): Promise<WebhookRecord[]> {
    return prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
    });
  }

  async function updateLastTriggeredAt(webhookId: string): Promise<void> {
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { lastTriggeredAt: new Date() },
    });
  }

  return {
    createWebhook,
    findWebhooksByUserId,
    findWebhookById,
    updateWebhook,
    deleteWebhook,
    findActiveWebhooksByEvent,
    updateLastTriggeredAt,
  };
}
