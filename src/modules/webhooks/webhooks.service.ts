import crypto from 'node:crypto';
import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './webhooks.repository';
import type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhooksQuery,
  WebhookResponse,
  WebhookRecord,
  PaginatedWebhooks,
} from './webhooks.types';

const log = createServiceLogger('webhooks');

function mapToResponse(record: WebhookRecord): WebhookResponse {
  return {
    id: record.id,
    url: record.url,
    events: record.events,
    isActive: record.isActive,
    lastTriggeredAt: record.lastTriggeredAt,
    createdAt: record.createdAt,
  };
}

export async function createWebhook(
  userId: string,
  input: CreateWebhookInput,
): Promise<WebhookResponse> {
  const secret = crypto.randomBytes(32).toString('hex');

  const record = await repo.createWebhook({
    userId,
    url: input.url,
    events: input.events,
    secret,
  });

  log.info({ userId, webhookId: record.id }, 'Webhook created');

  return mapToResponse(record);
}

export async function listWebhooks(
  userId: string,
  query: WebhooksQuery,
): Promise<PaginatedWebhooks> {
  const { webhooks, total } = await repo.findWebhooksByUserId(userId, {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    page: query.page,
    limit: query.limit,
  });

  return {
    webhooks: webhooks.map(mapToResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getWebhook(userId: string, webhookId: string): Promise<WebhookResponse> {
  const record = await repo.findWebhookById(webhookId, userId);
  if (!record) {
    throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
  }
  return mapToResponse(record);
}

export async function updateWebhook(
  userId: string,
  webhookId: string,
  input: UpdateWebhookInput,
): Promise<WebhookResponse> {
  const existing = await repo.findWebhookById(webhookId, userId);
  if (!existing) {
    throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
  }

  const record = await repo.updateWebhook(webhookId, userId, {
    ...(input.url === undefined ? {} : { url: input.url }),
    ...(input.events === undefined ? {} : { events: input.events }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  });

  log.info({ userId, webhookId }, 'Webhook updated');

  return mapToResponse(record);
}

export async function deleteWebhook(userId: string, webhookId: string): Promise<void> {
  const existing = await repo.findWebhookById(webhookId, userId);
  if (!existing) {
    throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
  }

  await repo.deleteWebhook(webhookId, userId);
  log.info({ userId, webhookId }, 'Webhook deleted');
}
