'use client';

import { useQuery } from '@tanstack/react-query';
import { getBalance } from '@/lib/api/billing';
import { queryKeys } from '@/lib/query-keys';

export function useBalance() {
  return useQuery({
    queryKey: queryKeys.balance,
    queryFn: getBalance,
  });
}
