'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiKeys, generateApiKey, revokeApiKey } from '@/lib/api/api-keys';
import { ApiError } from '@/lib/api/client';
import type { ApiKeyCreatedResponse, RateLimitTier } from '@/lib/api/types';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import { Plus, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ApiKeyResponse } from '@/lib/api/types';

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<ApiKeyCreatedResponse | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<RateLimitTier>('BASIC');

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => getApiKeys({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () => generateApiKey({ name, rateLimitTier: tier }),
    onSuccess: (data) => {
      setNewKeyResult(data);
      setCreateOpen(false);
      setName('');
      setTier('BASIC');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create API key');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      toast.success('API key revoked');
      setRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke key');
    },
  });

  const columns: Column<ApiKeyResponse>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Tier',
      cell: (row) => <Badge variant="outline">{row.rateLimitTier}</Badge>,
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'default' : 'secondary'}>
          {row.isActive ? 'Active' : 'Revoked'}
        </Badge>
      ),
    },
    {
      header: 'Last Used',
      cell: (row) => (row.lastUsedAt ? formatDate(row.lastUsedAt) : 'Never'),
    },
    {
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
    {
      header: '',
      cell: (row) =>
        row.isActive ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setRevokeId(row.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        ) : null,
      className: 'w-12',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Manage your API access keys</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>Generate a new API key for external access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="My API Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Limit Tier</Label>
                <Select value={tier} onValueChange={(v) => setTier(v as RateLimitTier)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic (100 req/min)</SelectItem>
                    <SelectItem value="PRO">Pro (500 req/min)</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise (2000 req/min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {newKeyResult && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-4">
          <p className="text-sm font-medium mb-2">
            API key created. Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background p-2 rounded break-all border">
              {newKeyResult.rawKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(newKeyResult.rawKey);
                toast.success('Copied');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKeyResult(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.apiKeys ?? []}
        isLoading={isLoading}
        emptyMessage="No API keys created yet"
      />

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(open) => !open && setRevokeId(null)}
        title="Revoke API Key"
        description="This action cannot be undone. Any applications using this key will lose access."
        confirmLabel="Revoke"
        onConfirm={() => revokeId && revokeMutation.mutate(revokeId)}
        isLoading={revokeMutation.isPending}
      />
    </div>
  );
}
