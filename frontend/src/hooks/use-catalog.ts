'use client';

import { useQuery } from '@tanstack/react-query';
import { getCatalog, getService } from '@/lib/api/catalog';
import { queryKeys } from '@/lib/query-keys';

export function useCatalog(params?: {
  page?: number;
  limit?: number;
  platform?: string;
  type?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.catalog.list(params),
    queryFn: () => getCatalog(params),
  });
}

export function useService(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.catalog.service(serviceId),
    queryFn: () => getService(serviceId),
    enabled: !!serviceId,
  });
}

/**
 * Full catalog snapshot (single page of up to 100 services) used by the
 * admin landing editors to populate tier service pickers.
 */
export function useAllServices() {
  return useQuery({
    queryKey: queryKeys.catalog.allServices,
    queryFn: () => getCatalog({ limit: 100 }),
  });
}
