'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrackingLinks, createTrackingLink, deleteTrackingLink } from '@/lib/api/tracking';
import type { TrackingLinkWithStats } from '@/lib/api/tracking';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { Trash2, Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  trackingFormSchema,
  defaultTrackingFormValues,
  type TrackingFormValues,
} from '@/lib/validation/admin-forms';

interface TrackingLinkCallbacks {
  onCopy: (code: string) => void;
  onDelete: (id: string) => void;
}

function TrackingLinkCopyCell({
  row,
  onCopy,
}: Readonly<{
  row: TrackingLinkWithStats;
  onCopy: (code: string) => void;
}>) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
        /register?ref={row.code}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(row.code);
        }}
        aria-label="Copy referral code"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function TrackingLinkDeleteCell({
  row,
  onDelete,
}: Readonly<{
  row: TrackingLinkWithStats;
  onDelete: (id: string) => void;
}>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(row.id);
      }}
      aria-label="Delete referral"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}

const nameColumn: Column<TrackingLinkWithStats> = {
  header: 'Name',
  cell: (row: TrackingLinkWithStats) => <span className="font-medium">{row.name}</span>,
};

const codeColumn: Column<TrackingLinkWithStats> = {
  header: 'Code',
  cell: (row: TrackingLinkWithStats) => <span className="font-mono text-sm">{row.code}</span>,
};

const registrationsColumn: Column<TrackingLinkWithStats> = {
  header: 'Registrations',
  cell: (row: TrackingLinkWithStats) => row.registrations,
};

const lastRegistrationColumn: Column<TrackingLinkWithStats> = {
  header: 'Last Registration',
  cell: (row: TrackingLinkWithStats) =>
    row.lastRegistration ? formatDate(row.lastRegistration) : '-',
};

const createdColumn: Column<TrackingLinkWithStats> = {
  header: 'Created',
  cell: (row: TrackingLinkWithStats) => formatDate(row.createdAt),
};

function buildTrackingColumns(callbacks: TrackingLinkCallbacks): Column<TrackingLinkWithStats>[] {
  return [
    nameColumn,
    codeColumn,
    {
      header: 'Full Link',
      cell: (row: TrackingLinkWithStats) => (
        <TrackingLinkCopyCell row={row} onCopy={callbacks.onCopy} />
      ),
    },
    registrationsColumn,
    lastRegistrationColumn,
    createdColumn,
    {
      header: '',
      cell: (row: TrackingLinkWithStats) => (
        <TrackingLinkDeleteCell row={row} onDelete={callbacks.onDelete} />
      ),
      className: 'w-12',
    },
  ];
}

export default function AdminTrackingLinksPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const form = useForm<TrackingFormValues>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: defaultTrackingFormValues,
  });

  const code = form.watch('code');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminTrackingLinks,
    queryFn: getTrackingLinks,
  });

  const createMutation = useMutation({
    mutationFn: (values: TrackingFormValues) =>
      createTrackingLink({ code: values.code, name: values.name }),
    onSuccess: () => {
      toast.success('Tracking link created');
      setCreateOpen(false);
      form.reset(defaultTrackingFormValues);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTrackingLinks });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create tracking link'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrackingLink(id),
    onSuccess: () => {
      toast.success('Tracking link deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTrackingLinks });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to delete tracking link'));
    },
  });

  const copyToClipboard = (code: string) => {
    const url = `${globalThis.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    });
  };

  const columns = buildTrackingColumns({
    onCopy: copyToClipboard,
    onDelete: setDeleteId,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tracking Links</h1>
          <p className="text-muted-foreground">Track registrations from advertising campaigns</p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) form.reset(defaultTrackingFormValues);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tracking Link</DialogTitle>
              <DialogDescription>
                Create a new tracking link to monitor registrations from a campaign
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                noValidate
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Telegram Banner March" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="tg_banner_march"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value.toLowerCase().replaceAll(/[^a-z0-9_-]/g, ''),
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Only lowercase letters, numbers, dashes, and underscores
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {code && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Preview link:</p>
                    <p className="font-mono text-sm break-all">
                      {typeof globalThis === 'undefined' ? '' : globalThis.location.origin}
                      /register?ref=
                      {code}
                    </p>
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          title="No tracking links yet"
          description="Create your first tracking link to monitor campaign registrations"
        />
      )}
      {!isLoading && data && data.length > 0 && (
        <DataTable columns={columns} data={data} isLoading={isLoading} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Tracking Link"
        description="This will permanently delete the tracking link. Registration data will be preserved."
        confirmLabel="Delete"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
