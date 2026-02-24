import { apiRequest } from './client';
import type {
  CreateWebhookInput,
  PaginatedWebhooks,
  UpdateWebhookInput,
  WebhookResponse,
} from './types';

export const createWebhook = (data: CreateWebhookInput) =>
  apiRequest<WebhookResponse>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getWebhooks = (params?: { page?: number; limit?: number; isActive?: boolean }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  const qs = searchParams.toString();
  return apiRequest<PaginatedWebhooks>(`/webhooks${qs ? `?${qs}` : ''}`);
};

export const getWebhook = (webhookId: string) =>
  apiRequest<WebhookResponse>(`/webhooks/${webhookId}`);

export const updateWebhook = (webhookId: string, data: UpdateWebhookInput) =>
  apiRequest<WebhookResponse>(`/webhooks/${webhookId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteWebhook = (webhookId: string) =>
  apiRequest<void>(`/webhooks/${webhookId}`, { method: 'DELETE' });
