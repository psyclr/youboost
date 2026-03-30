'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrackingLinks, createTrackingLink, deleteTrackingLink } from '@/lib/api/tracking';
import type { TrackingLinkWithStats } from '@/lib/api/tracking';
import { ApiError } from '@/lib/api/client';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

interface TrackingFormData {
  code: string;
  name: string;
}

const defaultForm: TrackingFormData = { code: '', name: '' };

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

const staticTrackingColumns: Column<TrackingLinkWithStats>[] = [
  {
    header: 'Name',
    cell: (row: TrackingLinkWithStats) => <span className="font-medium">{row.name}</span>,
  },
  {
    header: 'Code',
    cell: (row: TrackingLinkWithStats) => <span className="font-mono text-sm">{row.code}</span>,
  },
  {
    header: 'Registrations',
    cell: (row: TrackingLinkWithStats) => row.registrations,
  },
  {
    header: 'Last Registration',
    cell: (row: TrackingLinkWithStats) =>
      row.lastRegistration ? formatDate(row.lastRegistration) : '-',
  },
  {
    header: 'Created',
    cell: (row: TrackingLinkWithStats) => formatDate(row.createdAt),
  },
];

function buildTrackingColumns(callbacks: TrackingLinkCallbacks): Column<TrackingLinkWithStats>[] {
  return [
    staticTrackingColumns[0],
    staticTrackingColumns[1],
    {
      header: 'Full Link',
      cell: (row: TrackingLinkWithStats) => (
        <TrackingLinkCopyCell row={row} onCopy={callbacks.onCopy} />
      ),
    },
    staticTrackingColumns[2],
    staticTrackingColumns[3],
    staticTrackingColumns[4],
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
  const [form, setForm] = useState<TrackingFormData>(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tracking-links'],
    queryFn: getTrackingLinks,
  });

  const createMutation = useMutation({
    mutationFn: (formData: TrackingFormData) =>
      createTrackingLink({ code: formData.code, name: formData.name }),
    onSuccess: () => {
      toast.success('Tracking link created');
      setCreateOpen(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tracking-links'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create tracking link');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTrackingLink(id),
    onSuccess: () => {
      toast.success('Tracking link deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tracking-links'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete tracking link');
    },
  });

  const copyToClipboard = (code: string) => {
    const url = `${globalThis.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    });
  };

  const updateField = (key: keyof TrackingFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
            if (!open) setForm(defaultForm);
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Telegram Banner March"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  placeholder="tg_banner_march"
                  value={form.code}
                  onChange={(e) =>
                    updateField('code', e.target.value.toLowerCase().replaceAll(/[^a-z0-9_-]/g, ''))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, dashes, and underscores
                </p>
              </div>
              {form.code && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">Preview link:</p>
                  <p className="font-mono text-sm break-all">
                    {typeof globalThis === 'undefined' ? '' : globalThis.location.origin}
                    /register?ref=
                    {form.code}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.code || !form.name || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
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
