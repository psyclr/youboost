'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { usePagination } from '@/hooks/use-pagination';
import { listTickets, createTicket } from '@/lib/api/support';
import type { TicketResponse } from '@/lib/api/support';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { sanitizeInput } from '@/lib/utils/sanitize';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { TicketStatusBadge, TicketPriorityBadge } from '@/components/shared/ticket-badges';
import { TICKET_STATUS_FILTER_OPTIONS } from '@/lib/constants/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const statuses = TICKET_STATUS_FILTER_OPTIONS;

interface CreateTicketForm {
  subject: string;
  description: string;
  priority: string;
}

const columns: Column<TicketResponse>[] = [
  {
    header: 'Subject',
    cell: (row) => <span className="font-medium">{row.subject}</span>,
  },
  {
    header: 'Status',
    cell: (row) => <TicketStatusBadge status={row.status} />,
  },
  {
    header: 'Priority',
    cell: (row) => <TicketPriorityBadge priority={row.priority} />,
  },
  {
    header: 'Created',
    cell: (row) => formatDate(row.createdAt),
  },
];

export default function SupportPage() {
  const [status, setStatus] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const { page, setPage } = usePagination();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tickets.list({ page, status }),
    queryFn: () =>
      listTickets({
        page,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTicketForm) => {
      // Sanitize inputs before sending
      return createTicket({
        subject: sanitizeInput(data.subject),
        description: sanitizeInput(data.description),
        priority: data.priority,
      });
    },
    onSuccess: () => {
      toast.success('Ticket created');
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create ticket'));
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTicketForm>({
    defaultValues: { subject: '', description: '', priority: 'LOW' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">Get help from our support team</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
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
          description="Create a ticket to get help from our support team"
        />
      )}
      {!isLoading && data?.tickets && data.tickets.length > 0 && (
        <DataTable
          columns={columns}
          data={data.tickets}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/support/${row.id}`)}
          pagination={{
            page: data.pagination.page,
            totalPages: data.pagination.totalPages,
            onPageChange: setPage,
          }}
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and our team will get back to you.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief summary of your issue"
                {...register('subject', {
                  required: 'Subject is required',
                  minLength: { value: 3, message: 'At least 3 characters' },
                  maxLength: { value: 255, message: 'Max 255 characters' },
                })}
              />
              {errors.subject && (
                <p className="text-sm text-destructive">{errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="Describe your issue in detail…"
                {...register('description', {
                  required: 'Description is required',
                  minLength: { value: 10, message: 'At least 10 characters' },
                  maxLength: { value: 5000, message: 'Max 5000 characters' },
                })}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Ticket'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
