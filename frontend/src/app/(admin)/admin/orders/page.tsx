'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminOrders, forceOrderStatus, refundOrder } from '@/lib/api/admin';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AdminOrderResponse, OrderStatus } from '@/lib/api/types';
import { toast } from 'sonner';

const statuses = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const allStatuses: OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'CANCELLED',
  'FAILED',
  'REFUNDED',
];

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('ALL');
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderResponse | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>('COMPLETED');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', { page, status }],
    queryFn: () =>
      getAdminOrders({
        page,
        limit: 20,
        status: status === 'ALL' ? undefined : (status as OrderStatus),
      }),
  });

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

  const columns: Column<AdminOrderResponse>[] = [
    {
      header: 'Order ID',
      cell: (row) => <span className="font-mono text-xs">{row.orderId.slice(0, 8)}...</span>,
    },
    {
      header: 'User',
      cell: (row) => <span className="font-mono text-xs">{row.userId.slice(0, 8)}...</span>,
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { header: 'Qty', accessorKey: 'quantity' },
    {
      header: 'Price',
      cell: (row) => formatCurrency(row.price),
    },
    {
      header: 'Date',
      cell: (row) => formatDate(row.createdAt),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setSelectedOrder(row)}>
            Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefundOrderId(row.orderId)}>
            Refund
          </Button>
        </div>
      ),
      className: 'w-40',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Manage all platform orders</p>
      </div>

      <div className="flex gap-4">
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
              Change status for order {selectedOrder?.orderId.slice(0, 8)}...
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
              {forceStatusMutation.isPending ? 'Updating...' : 'Update Status'}
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
