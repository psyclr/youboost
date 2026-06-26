'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export function useUrlParam(key: string, defaultValue: string): [string, (v: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = useCallback(
    (v: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (v === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, v);
      }
      // Changing a filter resets pagination to the first page.
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname, key, defaultValue],
  );

  return [value, setValue];
}
