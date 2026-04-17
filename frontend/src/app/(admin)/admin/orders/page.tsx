'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminOrders,
  forceOrderStatus,
  refundOrder,
  pauseDripFeed,
  resumeDripFeed,
} from '@/lib/api/admin';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AdminOrderResponse, OrderStatus } from '@/lib/api/types';
import { toast } from 'sonner';

const statuses = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'STUCK', label: 'Stuck (>24h)' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const allStatuses: OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'FAILED',
  'REFUNDED',
];

interface OrderActionCallbacks {
  onStatusClick: (order: AdminOrderResponse) => void;
  onRefundClick: (orderId: string) => void;
  onPause: (orderId: string) => void;
  onResume: (orderId: string) => void;
  pausePending: boolean;
  resumePending: boolean;
}

function OrderActionsCell({
  row,
  callbacks,
}: Readonly<{
  row: AdminOrderResponse;
  callbacks: OrderActionCallbacks;
}>) {
  return (
    <div className="flex gap-1">
      <Button variant="outline" size="sm" onClick={() => callbacks.onStatusClick(row)}>
        Status
      </Button>
      <Button variant="outline" size="sm" onClick={() => callbacks.onRefundClick(row.orderId)}>
        Refund
      </Button>
      {row.isDripFeed && row.status === 'PROCESSING' && !row.dripFeedPausedAt && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callbacks.onPause(row.orderId)}
          disabled={callbacks.pausePending}
        >
          Pause
        </Button>
      )}
      {row.isDripFeed && row.status === 'PROCESSING' && row.dripFeedPausedAt && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => callbacks.onResume(row.orderId)}
          disabled={callbacks.resumePending}
        >
          Resume
        </Button>
      )}
    </div>
  );
}

function DripFeedCell({ row }: Readonly<{ row: AdminOrderResponse }>) {
  if (!row.isDripFeed) return <>{'\u2014'}</>;
  const progress = `${row.dripFeedRunsCompleted}/${row.dripFeedRuns} runs`;
  if (row.dripFeedPausedAt) {
    return <span className="text-yellow-600">{progress} (paused)</span>;
  }
  return <>{progress}</>;
}

const staticColumns: Column<AdminOrderResponse>[] = [
  {
    header: 'Order ID',
    cell: (row: AdminOrderResponse) => (
      <span className="font-mono text-xs">{row.orderId.slice(0, 8)}…</span>
    ),
  },
  {
    header: 'User',
    cell: (row: AdminOrderResponse) => (
      <span className="font-mono text-xs">{row.userId.slice(0, 8)}…</span>
    ),
  },
  {
    header: 'Status',
    cell: (row: AdminOrderResponse) => <StatusBadge status={row.status} />,
  },
  {
    header: 'Qty',
    cell: (row: AdminOrderResponse) => <span className="tabular-nums">{row.quantity}</span>,
  },
  {
    header: 'Drip-feed',
    cell: (row: AdminOrderResponse) => <DripFeedCell row={row} />,
  },
  {
    header: 'Price',
    cell: (row: AdminOrderResponse) => (
      <span className="tabular-nums">{formatCurrency(row.price)}</span>
    ),
  },
  {
    header: 'Date',
    cell: (row: AdminOrderResponse) => formatDate(row.createdAt),
  },
];

function buildOrderColumns(callbacks: OrderActionCallbacks): Column<AdminOrderResponse>[] {
  return [
    ...staticColumns,
    {
      header: 'Actions',
      cell: (row: AdminOrderResponse) => <OrderActionsCell row={row} callbacks={callbacks} />,
      className: 'w-56',
    },
  ];
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('ALL');
  const [dripFeedOnly, setDripFeedOnly] = useState(false);
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderResponse | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>('COMPLETED');

  const apiStatus = status === 'STUCK' ? 'PROCESSING' : status;

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['admin', 'orders', { page, status, dripFeedOnly }],
    queryFn: () =>
      getAdminOrders({
        page,
        limit: status === 'STUCK' ? 100 : 20,
        status: apiStatus === 'ALL' ? undefined : (apiStatus as OrderStatus),
        isDripFeed: dripFeedOnly ? true : undefined,
      }),
  });

  // Client-side filter for "stuck" — PROCESSING orders older than 24h
  const data =
    status === 'STUCK' && rawData
      ? {
          ...rawData,
          orders: rawData.orders.filter(
            (o) => new Date(o.updatedAt).getTime() < Date.now() - STUCK_THRESHOLD_MS,
          ),
        }
      : rawData;

  const forceStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      forceOrderStatus(orderId, status),
    onSuccess: () => {
      toast.success('Order status updated');
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
    },
  });

  const refundMutation = useMutation({
    mutationFn: (orderId: string) => refundOrder(orderId),
    onSuccess: () => {
      toast.success('Order refunded');
      setRefundOrderId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to refund order');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (orderId: string) => pauseDripFeed(orderId),
    onSuccess: () => {
      toast.success('Drip-feed paused');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to pause drip-feed');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (orderId: string) => resumeDripFeed(orderId),
    onSuccess: () => {
      toast.success('Drip-feed resumed');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resume drip-feed');
    },
  });

  const columns = buildOrderColumns({
    onStatusClick: setSelectedOrder,
    onRefundClick: setRefundOrderId,
    onPause: (id: string) => pauseMutation.mutate(id),
    onResume: (id: string) => resumeMutation.mutate(id),
    pausePending: pauseMutation.isPending,
    resumePending: resumeMutation.isPending,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Manage all platform orders</p>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={dripFeedOnly} onCheckedChange={setDripFeedOnly} />
          Drip-feed only
        </label>
      </div>

      <DataTable
        columns={columns}
        data={data?.orders ?? []}
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
      />

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Order Status</DialogTitle>
            <DialogDescription>
              Change status for order {selectedOrder?.orderId.slice(0, 8)}…
            </DialogDescription>
          </DialogHeader>
          <Select value={newStatus} onValueChange={(v) => setNewStatus(v as OrderStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              onClick={() =>
                selectedOrder &&
                forceStatusMutation.mutate({
                  orderId: selectedOrder.orderId,
                  status: newStatus,
                })
              }
              disabled={forceStatusMutation.isPending}
            >
              {forceStatusMutation.isPending ? 'Updating…' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!refundOrderId}
        onOpenChange={(open) => !open && setRefundOrderId(null)}
        title="Refund Order"
        description="This will refund the order amount to the user's balance."
        confirmLabel="Refund"
        variant="destructive"
        onConfirm={() => refundOrderId && refundMutation.mutate(refundOrderId)}
        isLoading={refundMutation.isPending}
      />
    </div>
  );
}
