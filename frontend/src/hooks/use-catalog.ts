'use client';

import { useQuery } from '@tanstack/react-query';
import { getCatalog, getService } from '@/lib/api/catalog';

export function useCatalog(params?: {
  page?: number;
  limit?: number;
  platform?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ['catalog', params],
    queryFn: () => getCatalog(params),
  });
}

export function useService(serviceId: string) {
  return useQuery({
    queryKey: ['catalog', serviceId],
    queryFn: () => getService(serviceId),
    enabled: !!serviceId,
  });
}
