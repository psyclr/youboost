import { apiRequest } from './client';
import type { CatalogService, PaginatedCatalog } from './types';

export const getCatalog = (params?: {
  page?: number;
  limit?: number;
  platform?: string;
  type?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.platform) searchParams.set('platform', params.platform);
  if (params?.type) searchParams.set('type', params.type);
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const url = `/catalog/services${query}`;
  return apiRequest<PaginatedCatalog>(url);
};

export const getService = (serviceId: string) =>
  apiRequest<CatalogService>(`/catalog/services/${serviceId}`);
