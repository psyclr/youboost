'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/lib/api/billing';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { TransactionSummary, LedgerType } from '@/lib/api/types';
import Link from 'next/link';

const types: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAW', label: 'Withdraw' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'RELEASE', label: 'Release' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'FEE', label: 'Fee' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Admin Adjustment' },
];

const columns: Column<TransactionSummary>[] = [
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

export default function TransactionsPage() {
  const [type, setType] = useState('ALL');
  const { page, setPage } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', { page, type }],
    queryFn: () =>
      getTransactions({
        page,
        limit: 20,
        type: type === 'ALL' ? undefined : (type as LedgerType),
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/billing">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Your complete transaction history</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.transactions ?? []}
        isLoading={isLoading}
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyMessage="No transactions found"
      />
    </div>
  );
}
