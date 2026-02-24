'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook } from '@/lib/api/webhooks';
import { ApiError } from '@/lib/api/client';
import type { WebhookEvent, WebhookResponse, CreateWebhookInput } from '@/lib/api/types';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const ALL_EVENTS: WebhookEvent[] = [
  'order.created',
  'order.completed',
  'order.failed',
  'order.partial',
  'order.cancelled',
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => getWebhooks({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateWebhookInput) => createWebhook(data),
    onSuccess: () => {
      toast.success('Webhook created');
      setCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create webhook');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateWebhook(id, data),
    onSuccess: () => {
      toast.success('Webhook updated');
      setEditWebhook(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update webhook');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      toast.success('Webhook deleted');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete webhook');
    },
  });

  const resetForm = () => {
    setUrl('');
    setSelectedEvents([]);
  };

  const openEdit = (webhook: WebhookResponse) => {
    setEditWebhook(webhook);
    setUrl(webhook.url);
    setSelectedEvents(webhook.events);
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const columns: Column<WebhookResponse>[] = [
    {
      header: 'URL',
      cell: (row) => (
        <span className="text-sm font-mono truncate max-w-[200px] block">{row.url}</span>
      ),
    },
    {
      header: 'Events',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.events.map((e) => (
            <Badge key={e} variant="outline" className="text-xs">
              {e}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'default' : 'secondary'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Last Triggered',
      cell: (row) => (row.lastTriggeredAt ? formatDate(row.lastTriggeredAt) : 'Never'),
    },
    {
      header: '',
      cell: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      className: 'w-24',
    },
  ];

  const webhookForm = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Endpoint URL</Label>
        <Input
          placeholder="https://your-server.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Events</Label>
        <div className="space-y-2">
          {ALL_EVENTS.map((event) => (
            <div key={event} className="flex items-center gap-2">
              <Switch
                checked={selectedEvents.includes(event)}
                onCheckedChange={() => toggleEvent(event)}
              />
              <span className="text-sm">{event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Receive notifications for order events</p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>Configure a new webhook endpoint</DialogDescription>
            </DialogHeader>
            {webhookForm}
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ url, events: selectedEvents })}
                disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={data?.webhooks ?? []}
        isLoading={isLoading}
        emptyMessage="No webhooks configured yet"
      />

      <Dialog
        open={!!editWebhook}
        onOpenChange={(open) => {
          if (!open) {
            setEditWebhook(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update webhook configuration</DialogDescription>
          </DialogHeader>
          {webhookForm}
          <DialogFooter>
            <Button
              onClick={() =>
                editWebhook &&
                updateMutation.mutate({
                  id: editWebhook.id,
                  data: { url, events: selectedEvents },
                })
              }
              disabled={!url || selectedEvents.length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Webhook"
        description="This will permanently delete this webhook. You will no longer receive notifications at this URL."
        confirmLabel="Delete"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
