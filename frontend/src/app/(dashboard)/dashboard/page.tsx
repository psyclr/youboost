'use client';

import { useBalance } from '@/hooks/use-balance';
import { useOrders } from '@/hooks/use-orders';
import { BalanceWidget } from '@/components/shared/balance-widget';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import type { OrderResponse } from '@/lib/api/types';
import { useRouter } from 'next/navigation';

const orderColumns: Column<OrderResponse>[] = [
  {
    header: 'Order ID',
    cell: (row) => <span className="font-mono text-xs">{row.orderId.slice(0, 8)}...</span>,
  },
  {
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} />,
  },
  { header: 'Quantity', accessorKey: 'quantity' },
  {
    header: 'Price',
    cell: (row) => formatCurrency(row.price),
  },
  {
    header: 'Date',
    cell: (row) => formatDate(row.createdAt),
  },
];

export default function DashboardPage() {
  const { data: balance, isLoading: balanceLoading } = useBalance();
  const { data: ordersData, isLoading: ordersLoading } = useOrders({ limit: 5 });
  const router = useRouter();

  const totalOrders = ordersData?.pagination.total ?? 0;
  const totalSpent = ordersData?.orders.reduce((sum, o) => sum + o.price, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to your panel</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <BalanceWidget balance={balance} isLoading={balanceLoading} />
        <StatCard
          title="Total Orders"
          value={totalOrders}
          icon={ShoppingCart}
          description="All time orders"
        />
        <StatCard title="Total Spent" value={formatCurrency(totalSpent)} icon={DollarSign} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Orders</h2>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <DataTable
          columns={orderColumns}
          data={ordersData?.orders ?? []}
          isLoading={ordersLoading}
          onRowClick={(row) => router.push(`/orders/${row.orderId}`)}
          emptyMessage="No orders yet. Browse the catalog to get started."
        />
      </div>
    </div>
  );
}
