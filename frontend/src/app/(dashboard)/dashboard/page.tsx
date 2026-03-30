'use client';

import { useBalance } from '@/hooks/use-balance';
import { useOrders } from '@/hooks/use-orders';
import { BalanceWidget } from '@/components/shared/balance-widget';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Rocket,
  CreditCard,
  Search,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { OrderResponse } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const orderColumns: Column<OrderResponse>[] = [
  {
    header: 'Order ID',
    cell: (row) => <span className="font-mono text-xs">{row.orderId.slice(0, 8)}&hellip;</span>,
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

      {totalOrders === 0 && !ordersLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <CardTitle>Get Started with youboost</CardTitle>
            </div>
            <CardDescription>Follow these steps to place your first order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/billing/deposit">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">1. Add Funds</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/catalog">
                  <Search className="h-5 w-5" />
                  <span className="font-medium">2. Browse Services</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link href="/orders/new">
                  <Package className="h-5 w-5" />
                  <span className="font-medium">3. Place Order</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
