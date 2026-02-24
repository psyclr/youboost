import { apiRequest } from './client';
import type { ApiKeyCreatedResponse, CreateApiKeyInput, PaginatedApiKeys } from './types';

export const generateApiKey = (data: CreateApiKeyInput) =>
  apiRequest<ApiKeyCreatedResponse>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getApiKeys = (params?: { page?: number; limit?: number; isActive?: boolean }) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  const qs = searchParams.toString();
  return apiRequest<PaginatedApiKeys>(`/api-keys${qs ? `?${qs}` : ''}`);
};

export const revokeApiKey = (keyId: string) =>
  apiRequest<void>(`/api-keys/${keyId}`, { method: 'DELETE' });
