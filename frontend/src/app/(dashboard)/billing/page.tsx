'use client';

import { useBalance } from '@/hooks/use-balance';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/lib/api/billing';
import { BalanceWidget } from '@/components/shared/balance-widget';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import type { TransactionSummary, LedgerType } from '@/lib/api/types';
import Link from 'next/link';

function txBadgeVariant(type: LedgerType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'DEPOSIT':
    case 'REFUND':
      return 'default';
    case 'HOLD':
    case 'WITHDRAW':
    case 'FEE':
      return 'destructive';
    case 'RELEASE':
      return 'secondary';
    default:
      return 'outline';
  }
}

const txColumns: Column<TransactionSummary>[] = [
  {
    header: 'Type',
    cell: (row) => <Badge variant={txBadgeVariant(row.type)}>{row.type}</Badge>,
  },
  {
    header: 'Amount',
    cell: (row) => (
      <span className={row.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
        {row.amount >= 0 ? '+' : ''}
        {formatCurrency(row.amount)}
      </span>
    ),
  },
  {
    header: 'Description',
    cell: (row) => <span className="text-sm text-muted-foreground">{row.description ?? '—'}</span>,
  },
  {
    header: 'Date',
    cell: (row) => formatDate(row.createdAt),
  },
];

export default function BillingPage() {
  const { data: balance, isLoading: balanceLoading } = useBalance();
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', { limit: 5 }],
    queryFn: () => getTransactions({ limit: 5 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your balance and transactions</p>
      </div>

      <Card>
        <BalanceWidget balance={balance} isLoading={balanceLoading} variant="hero" />
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link
            href="/billing/transactions"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <DataTable
          columns={txColumns}
          data={txData?.transactions ?? []}
          isLoading={txLoading}
          emptyMessage="No transactions yet"
        />
      </div>

      <div className="rounded-lg bg-muted/50 flex items-center justify-center h-24">
        <span className="text-xs text-muted-foreground/60">Sponsored</span>
      </div>
    </div>
  );
}
