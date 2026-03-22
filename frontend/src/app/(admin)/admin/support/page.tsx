'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/use-pagination';
import { adminListTickets } from '@/lib/api/support';
import type { TicketResponse } from '@/lib/api/support';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

const statusConfig: Record<string, { className: string; label: string }> = {
  OPEN: {
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Open',
  },
  IN_PROGRESS: {
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'In Progress',
  },
  RESOLVED: {
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Resolved',
  },
  CLOSED: {
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    label: 'Closed',
  },
};

const priorityConfig: Record<string, { className: string }> = {
  LOW: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  MEDIUM: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  HIGH: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  URGENT: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

const statuses = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function AdminSupportPage() {
  const [status, setStatus] = useState('ALL');
  const { page, setPage } = usePagination();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'support', 'tickets', { page, status }],
    queryFn: () =>
      adminListTickets({
        page,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  const columns: Column<TicketResponse>[] = [
    {
      header: 'Subject',
      cell: (row) => <span className="font-medium">{row.subject}</span>,
    },
    {
      header: 'User',
      cell: (row) => (
        <span className="text-xs">{row.username ?? row.userId.slice(0, 8) + '...'}</span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const cfg = statusConfig[row.status] ?? { className: '', label: row.status };
        return (
          <Badge variant="secondary" className={cfg.className}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      header: 'Priority',
      cell: (row) => {
        const cfg = priorityConfig[row.priority] ?? { className: '' };
        return (
          <Badge variant="secondary" className={cfg.className}>
            {row.priority}
          </Badge>
        );
      },
    },
    {
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">Manage all support tickets</p>
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

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !data?.tickets || data.tickets.length === 0 ? (
        <EmptyState
          title="No support tickets"
          description={
            status === 'ALL'
              ? 'No tickets have been submitted yet'
              : `No ${status.toLowerCase().replace('_', ' ')} tickets`
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data.tickets}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/admin/support/${row.id}`)}
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
