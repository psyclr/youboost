import { apiRequest } from './client';
import { buildQuery } from './query';
import type { CatalogService, PaginatedCatalog } from './types';

export const getCatalog = (params?: {
  page?: number;
  limit?: number;
  platform?: string;
  type?: string;
}) =>
  apiRequest<PaginatedCatalog>(
    `/catalog/services${buildQuery({
      page: params?.page || undefined,
      limit: params?.limit || undefined,
      platform: params?.platform,
      type: params?.type,
    })}`,
  );

export const getService = (serviceId: string) =>
  apiRequest<CatalogService>(`/catalog/services/${serviceId}`);
