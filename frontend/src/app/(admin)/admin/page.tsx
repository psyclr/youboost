'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '@/lib/api/admin';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Users, ShoppingCart, DollarSign, Package } from 'lucide-react';
import type { AdminOrderResponse } from '@/lib/api/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const orderColumns: Column<AdminOrderResponse>[] = [
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
  {
    header: 'Price',
    cell: (row) => formatCurrency(row.price),
  },
  {
    header: 'Date',
    cell: (row) => formatDate(row.createdAt),
  },
];

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboardStats,
  });

  const chartData = data?.recentOrders
    ? data.recentOrders
        .slice(0, 7)
        .reverse()
        .map((o) => ({
          date: new Date(o.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          revenue: o.price,
        }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and statistics</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={data?.totalUsers ?? 0} icon={Users} />
        <StatCard title="Total Orders" value={data?.totalOrders ?? 0} icon={ShoppingCart} />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data?.totalRevenue ?? 0)}
          icon={DollarSign}
        />
        <StatCard title="Active Services" value={data?.activeServices ?? 0} icon={Package} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <DataTable
          columns={orderColumns}
          data={data?.recentOrders ?? []}
          isLoading={isLoading}
          emptyMessage="No orders yet"
        />
      </div>
    </div>
  );
}
