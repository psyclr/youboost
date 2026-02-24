'use client';

import { useQuery } from '@tanstack/react-query';
import { getBalance } from '@/lib/api/billing';

export function useBalance() {
  return useQuery({
    queryKey: ['balance'],
    queryFn: getBalance,
  });
}
