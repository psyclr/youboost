'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { BalanceResponse } from '@/lib/api/types';

interface BalanceWidgetProps {
  balance: BalanceResponse | undefined;
  isLoading: boolean;
  variant?: 'compact' | 'hero';
}

export function BalanceWidget({
  balance,
  isLoading,
  variant = 'compact',
}: Readonly<BalanceWidgetProps>) {
  if (variant === 'hero') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {isLoading ? (
          <div className="h-12 w-48 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-4xl font-bold tracking-tight">
              {formatCurrency(balance?.available ?? 0)}
            </div>
            <p className="text-sm text-muted-foreground">Available balance</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>Total: {formatCurrency(balance?.balance ?? 0)}</span>
              <span>Frozen: {formatCurrency(balance?.frozen ?? 0)}</span>
            </div>
          </>
        )}
        <Button asChild size="lg">
          <Link href="/billing/deposit">
            <Plus className="h-4 w-4 mr-2" />
            Add Funds
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">{formatCurrency(balance?.available ?? 0)}</div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Total: {formatCurrency(balance?.balance ?? 0)}</span>
              <span>Frozen: {formatCurrency(balance?.frozen ?? 0)}</span>
            </div>
          </>
        )}
        <Button asChild size="sm" className="w-full">
          <Link href="/billing/deposit">
            <Plus className="h-4 w-4 mr-1" />
            Add Funds
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
