'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '@/lib/api/billing';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable } from '@/components/shared/data-table';
import { txColumns } from '@/app/(dashboard)/billing/page';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import type { LedgerType } from '@/lib/api/types';
import { LEDGER_TYPE_FILTER_OPTIONS } from '@/lib/constants/statuses';
import Link from 'next/link';

const types = LEDGER_TYPE_FILTER_OPTIONS;

const columns = txColumns;

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
