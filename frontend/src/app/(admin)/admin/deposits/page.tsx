'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminDeposits, adminConfirmDeposit, adminExpireDeposit } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AdminDepositResponse, DepositStatus } from '@/lib/api/types';
import { toast } from 'sonner';
import { CheckCircle, XCircle } from 'lucide-react';

const statuses = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'FAILED', label: 'Failed' },
];

export default function AdminDepositsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { page, setPage } = usePagination();
  const [confirmAction, setConfirmAction] = useState<{
    type: 'confirm' | 'expire';
    deposit: AdminDepositResponse;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-deposits', page, statusFilter],
    queryFn: () =>
      getAdminDeposits({
        page,
        limit: 20,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  const confirmMutation = useMutation({
    mutationFn: (depositId: string) => adminConfirmDeposit(depositId),
    onSuccess: () => {
      toast.success('Deposit confirmed');
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to confirm deposit');
    },
  });

  const expireMutation = useMutation({
    mutationFn: (depositId: string) => adminExpireDeposit(depositId),
    onSuccess: () => {
      toast.success('Deposit expired');
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to expire deposit');
    },
  });

  const handleAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'confirm') {
      confirmMutation.mutate(confirmAction.deposit.id);
    } else {
      expireMutation.mutate(confirmAction.deposit.id);
    }
    setConfirmAction(null);
  };

  const columns: Column<AdminDepositResponse>[] = [
    {
      header: 'ID',
      accessor: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}…</span>,
    },
    {
      header: 'User',
      accessor: (row) => <span className="font-mono text-xs">{row.userId.slice(0, 8)}…</span>,
    },
    {
      header: 'Amount',
      accessor: (row) => (
        <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status as DepositStatus} />,
    },
    {
      header: 'Created',
      accessor: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      accessor: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: 'confirm', deposit: row });
              }}
              aria-label="Confirm deposit"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmAction({ type: 'expire', deposit: row });
              }}
              aria-label="Expire deposit"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Expire
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deposits</h1>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.deposits ?? []}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={setPage}
        emptyMessage="No deposits found"
      />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === 'confirm' ? 'Confirm Deposit' : 'Expire Deposit'}
        description={
          confirmAction?.type === 'confirm'
            ? `This will credit ${formatCurrency(confirmAction.deposit.amount)} to user ${confirmAction.deposit.userId.slice(0, 8)}…'s wallet.`
            : `This will mark the deposit as expired. No funds will be credited.`
        }
        confirmLabel={confirmAction?.type === 'confirm' ? 'Confirm' : 'Expire'}
        variant={confirmAction?.type === 'confirm' ? 'default' : 'destructive'}
        onConfirm={handleAction}
        isLoading={confirmMutation.isPending || expireMutation.isPending}
      />
    </div>
  );
}
