'use client';

import { Suspense } from 'react';
import { useOrders } from '@/hooks/use-orders';
import { usePagination } from '@/hooks/use-pagination';
import { useSearchParams } from 'next/navigation';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Layers } from 'lucide-react';
import type { OrderResponse, OrderStatus } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const statuses: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const columns: Column<OrderResponse>[] = [
  {
    header: 'Order ID',
    cell: (row) => <span className="font-mono text-xs">{row.orderId.slice(0, 8)}…</span>,
  },
  {
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} />,
  },
  { header: 'Quantity', accessorKey: 'quantity', className: 'tabular-nums' },
  {
    header: 'Completed',
    accessorKey: 'completed',
    className: 'tabular-nums',
  },
  {
    header: 'Price',
    cell: (row) => formatCurrency(row.price),
    className: 'tabular-nums',
  },
  {
    header: 'Date',
    cell: (row) => formatDate(row.createdAt),
  },
];

function OrdersContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? 'ALL';
  const { page, setPage } = usePagination();
  const router = useRouter();

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    params.delete('page');
    router.push(`/orders?${params.toString()}`);
  };

  const { data, isLoading } = useOrders({
    page,
    limit: 20,
    status: status === 'ALL' ? undefined : (status as OrderStatus),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage your service orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/orders/bulk">
              <Layers className="h-4 w-4 mr-2" />
              Bulk Order
            </Link>
          </Button>
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={status} onValueChange={handleStatusChange}>
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

      {!isLoading && data?.orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Start by browsing the service catalog"
          actionLabel="Browse Catalog"
          actionHref="/catalog"
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.orders ?? []}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/orders/${row.orderId}`)}
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
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  );
}
