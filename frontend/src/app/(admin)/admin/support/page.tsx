'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/use-pagination';
import { adminListTickets } from '@/lib/api/support';
import { queryKeys } from '@/lib/query-keys';
import type { TicketResponse } from '@/lib/api/support';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { TicketStatusBadge, TicketPriorityBadge } from '@/components/shared/ticket-badges';
import { TICKET_STATUS_FILTER_OPTIONS } from '@/lib/constants/tickets';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

const statuses = TICKET_STATUS_FILTER_OPTIONS;

const columns: Column<TicketResponse>[] = [
  {
    header: 'Subject',
    cell: (row: TicketResponse) => <span className="font-medium">{row.subject}</span>,
  },
  {
    header: 'User',
    cell: (row: TicketResponse) => (
      <span className="text-xs">{row.username ?? row.userId.slice(0, 8) + '…'}</span>
    ),
  },
  {
    header: 'Status',
    cell: (row: TicketResponse) => <TicketStatusBadge status={row.status} />,
  },
  {
    header: 'Priority',
    cell: (row: TicketResponse) => <TicketPriorityBadge priority={row.priority} />,
  },
  {
    header: 'Created',
    cell: (row: TicketResponse) => formatDate(row.createdAt),
  },
];

export default function AdminSupportPage() {
  const [status, setStatus] = useState('ALL');
  const { page, setPage } = usePagination();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminSupportTickets.list({ page, status }),
    queryFn: () =>
      adminListTickets({
        page,
        status: status === 'ALL' ? undefined : status,
      }),
  });

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

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {!isLoading && (!data?.tickets || data.tickets.length === 0) && (
        <EmptyState
          title="No support tickets"
          description={
            status === 'ALL'
              ? 'No tickets have been submitted yet'
              : `No ${status.toLowerCase().replace('_', ' ')} tickets`
          }
        />
      )}
      {!isLoading && data?.tickets && data.tickets.length > 0 && (
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
