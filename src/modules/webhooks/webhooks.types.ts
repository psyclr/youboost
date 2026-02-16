import { z } from 'zod/v4';

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.completed',
  'order.failed',
  'order.partial',
  'order.cancelled',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createWebhookSchema = z.object({
  url: z.url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export const updateWebhookSchema = z.object({
  url: z.url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const webhookIdSchema = z.object({
  webhookId: z.string().uuid(),
});

export const webhooksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type WebhookIdParam = z.infer<typeof webhookIdSchema>;
export type WebhooksQuery = z.infer<typeof webhooksQuerySchema>;

export interface WebhookRecord {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface PaginatedWebhooks {
  webhooks: WebhookResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
