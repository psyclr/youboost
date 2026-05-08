import crypto from 'node:crypto';
import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import type { WebhooksRepository } from './webhooks.repository';
import type {
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhooksQuery,
  WebhookResponse,
  WebhookRecord,
  PaginatedWebhooks,
} from './webhooks.types';

export interface WebhooksService {
  createWebhook(userId: string, input: CreateWebhookInput): Promise<WebhookResponse>;
  listWebhooks(userId: string, query: WebhooksQuery): Promise<PaginatedWebhooks>;
  getWebhook(userId: string, webhookId: string): Promise<WebhookResponse>;
  updateWebhook(
    userId: string,
    webhookId: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookResponse>;
  deleteWebhook(userId: string, webhookId: string): Promise<void>;
}

export interface WebhooksServiceDeps {
  webhooksRepo: WebhooksRepository;
  logger: Logger;
}

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

export function createWebhooksService(deps: WebhooksServiceDeps): WebhooksService {
  const { webhooksRepo, logger } = deps;

  async function createWebhook(
    userId: string,
    input: CreateWebhookInput,
  ): Promise<WebhookResponse> {
    const secret = crypto.randomBytes(32).toString('hex');

    const record = await webhooksRepo.createWebhook({
      userId,
      url: input.url,
      events: input.events,
      secret,
    });

    logger.info({ userId, webhookId: record.id }, 'Webhook created');

    return mapToResponse(record);
  }

  async function listWebhooks(userId: string, query: WebhooksQuery): Promise<PaginatedWebhooks> {
    const { webhooks, total } = await webhooksRepo.findWebhooksByUserId(userId, {
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

  async function getWebhook(userId: string, webhookId: string): Promise<WebhookResponse> {
    const record = await webhooksRepo.findWebhookById(webhookId, userId);
    if (!record) {
      throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
    }
    return mapToResponse(record);
  }

  async function updateWebhook(
    userId: string,
    webhookId: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookResponse> {
    const existing = await webhooksRepo.findWebhookById(webhookId, userId);
    if (!existing) {
      throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
    }

    const record = await webhooksRepo.updateWebhook(webhookId, userId, {
      ...(input.url === undefined ? {} : { url: input.url }),
      ...(input.events === undefined ? {} : { events: input.events }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    });

    logger.info({ userId, webhookId }, 'Webhook updated');

    return mapToResponse(record);
  }

  async function deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const existing = await webhooksRepo.findWebhookById(webhookId, userId);
    if (!existing) {
      throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
    }

    await webhooksRepo.deleteWebhook(webhookId, userId);
    logger.info({ userId, webhookId }, 'Webhook deleted');
  }

  return { createWebhook, listWebhooks, getWebhook, updateWebhook, deleteWebhook };
}
