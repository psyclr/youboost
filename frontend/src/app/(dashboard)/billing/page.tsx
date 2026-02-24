'use client';

import { useBalance } from '@/hooks/use-balance';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/lib/api/billing';
import { BalanceWidget } from '@/components/shared/balance-widget';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, List } from 'lucide-react';
import type { TransactionSummary } from '@/lib/api/types';
import Link from 'next/link';

const txColumns: Column<TransactionSummary>[] = [
  {
    header: 'Type',
    cell: (row) => <Badge variant="outline">{row.type}</Badge>,
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
    queryKey: ['transactions', { limit: 10 }],
    queryFn: () => getTransactions({ limit: 10 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your balance and transactions</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <BalanceWidget balance={balance} isLoading={balanceLoading} />
        <div className="flex flex-col gap-2">
          <Button asChild size="lg">
            <Link href="/billing/deposit">
              <Plus className="h-4 w-4 mr-2" />
              Deposit Funds
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/billing/transactions">
              <List className="h-4 w-4 mr-2" />
              View All Transactions
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <DataTable
          columns={txColumns}
          data={txData?.transactions ?? []}
          isLoading={txLoading}
          emptyMessage="No transactions yet"
        />
      </div>
    </div>
  );
}
