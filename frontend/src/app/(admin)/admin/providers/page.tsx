'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProviders,
  createProvider,
  updateProvider,
  deactivateProvider,
  getProviderServices,
  getProviderBalance,
} from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Pencil, Wallet, List } from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderResponse, ProviderServiceItem } from '@/lib/api/types';

interface ProviderFormData {
  name: string;
  apiEndpoint: string;
  apiKey: string;
  priority: string;
}

const defaultForm: ProviderFormData = {
  name: '',
  apiEndpoint: '',
  apiKey: '',
  priority: '0',
};

const staticServiceColumns: Column<ProviderServiceItem>[] = [
  { header: 'ID', accessorKey: 'serviceId' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Category', accessorKey: 'category' },
  {
    header: 'Rate',
    cell: (row: ProviderServiceItem) => `$${row.rate}`,
  },
  { header: 'Min', accessorKey: 'min' },
  { header: 'Max', accessorKey: 'max' },
  {
    header: '',
    cell: () => (
      <Button variant="outline" size="sm">
        Create Service
      </Button>
    ),
    className: 'w-32',
  },
];

interface ProviderActionCallbacks {
  onEdit: (provider: ProviderResponse) => void;
  onCheckBalance: (providerId: string) => void;
  checkingBalanceId: string | null;
  onViewServices: (provider: ProviderResponse) => void;
  onDeactivate: (providerId: string) => void;
  onActivate: (providerId: string) => void;
}

function ProviderActionsCell({
  row,
  callbacks,
}: Readonly<{
  row: ProviderResponse;
  callbacks: ProviderActionCallbacks;
}>) {
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => callbacks.onEdit(row)}
        aria-label="Edit provider"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => callbacks.onCheckBalance(row.providerId)}
        disabled={callbacks.checkingBalanceId === row.providerId}
        aria-label="Check balance"
      >
        <Wallet className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => callbacks.onViewServices(row)}
        aria-label="View services"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (
            row.isActive &&
            !globalThis.confirm(
              `Deactivate "${row.name}"? Services linked to this provider may stop working.`,
            )
          )
            return;
          if (row.isActive) {
            callbacks.onDeactivate(row.providerId);
          } else {
            callbacks.onActivate(row.providerId);
          }
        }}
      >
        {row.isActive ? 'Deactivate' : 'Activate'}
      </Button>
    </div>
  );
}

const staticProviderColumns: Column<ProviderResponse>[] = [
  { header: 'Name', accessorKey: 'name' },
  {
    header: 'Endpoint',
    cell: (row: ProviderResponse) => (
      <span className="text-xs font-mono truncate max-w-[200px] block">{row.apiEndpoint}</span>
    ),
  },
  { header: 'Priority', accessorKey: 'priority' },
  {
    header: 'Status',
    cell: (row: ProviderResponse) => (
      <Badge variant={row.isActive ? 'default' : 'secondary'}>
        {row.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

function buildProviderColumns(callbacks: ProviderActionCallbacks): Column<ProviderResponse>[] {
  return [
    ...staticProviderColumns,
    {
      header: '',
      cell: (row: ProviderResponse) => <ProviderActionsCell row={row} callbacks={callbacks} />,
      className: 'w-56',
    },
  ];
}

export default function AdminProvidersPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderResponse | null>(null);
  const [form, setForm] = useState<ProviderFormData>(defaultForm);
  const [servicesProvider, setServicesProvider] = useState<ProviderResponse | null>(null);
  const [checkingBalanceId, setCheckingBalanceId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'providers', { page }],
    queryFn: () => getProviders({ page, limit: 20 }),
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['provider-services', servicesProvider?.providerId],
    queryFn: () => getProviderServices(servicesProvider!.providerId),
    enabled: !!servicesProvider,
  });

  const createMutation = useMutation({
    mutationFn: (formData: ProviderFormData) =>
      createProvider({
        name: formData.name,
        apiEndpoint: formData.apiEndpoint,
        apiKey: formData.apiKey,
        priority: Number.parseInt(formData.priority, 10) || 0,
      }),
    onSuccess: () => {
      toast.success('Provider created');
      setCreateOpen(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create provider');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Record<string, unknown> }) => {
      await updateProvider(id, updateData);
    },
    onSuccess: () => {
      toast.success('Provider updated');
      setEditProvider(null);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update provider');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateProvider(id),
    onSuccess: () => {
      toast.success('Provider deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate provider');
    },
  });

  const handleCheckBalance = async (providerId: string) => {
    setCheckingBalanceId(providerId);
    try {
      const result = await getProviderBalance(providerId);
      toast.success(`Balance: ${result.currency} ${result.balance.toFixed(2)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to check balance');
    } finally {
      setCheckingBalanceId(null);
    }
  };

  const openEdit = (provider: ProviderResponse) => {
    setEditProvider(provider);
    setForm({
      name: provider.name,
      apiEndpoint: provider.apiEndpoint,
      apiKey: '',
      priority: String(provider.priority),
    });
  };

  const updateField = (key: keyof ProviderFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const providerForm = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>API Endpoint</Label>
        <Input
          value={form.apiEndpoint}
          onChange={(e) => updateField('apiEndpoint', e.target.value)}
          placeholder="https://provider-api.com/v1"
        />
      </div>
      <div className="space-y-2">
        <Label>API Key</Label>
        <Input
          type="password"
          value={form.apiKey}
          onChange={(e) => updateField('apiKey', e.target.value)}
          placeholder={editProvider ? 'Leave empty to keep current' : ''}
        />
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Input
          type="number"
          value={form.priority}
          onChange={(e) => updateField('priority', e.target.value)}
        />
      </div>
    </div>
  );

  const columns = buildProviderColumns({
    onEdit: openEdit,
    onCheckBalance: handleCheckBalance,
    checkingBalanceId,
    onViewServices: setServicesProvider,
    onDeactivate: (id: string) => deactivateMutation.mutate(id),
    onActivate: (id: string) => updateMutation.mutate({ id, data: { isActive: true } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-muted-foreground">Manage SMM service providers</p>
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
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Provider</DialogTitle>
              <DialogDescription>Add a new SMM service provider</DialogDescription>
            </DialogHeader>
            {providerForm}
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={
                  !form.name || !form.apiEndpoint || !form.apiKey || createMutation.isPending
                }
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={data?.providers ?? []}
        isLoading={isLoading}
        pagination={
          data?.pagination
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      {/* Edit Dialog */}
      <Dialog
        open={!!editProvider}
        onOpenChange={(open) => {
          if (!open) {
            setEditProvider(null);
            setForm(defaultForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update provider configuration</DialogDescription>
          </DialogHeader>
          {providerForm}
          <DialogFooter>
            <Button
              onClick={() => {
                if (!editProvider) return;
                const updateData: Record<string, unknown> = {
                  name: form.name,
                  apiEndpoint: form.apiEndpoint,
                  priority: Number.parseInt(form.priority, 10) || 0,
                };
                if (form.apiKey) {
                  updateData.apiKey = form.apiKey;
                }
                updateMutation.mutate({
                  id: editProvider.providerId,
                  data: updateData,
                });
              }}
              disabled={!form.name || !form.apiEndpoint || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Services Dialog */}
      <Dialog
        open={!!servicesProvider}
        onOpenChange={(open) => {
          if (!open) setServicesProvider(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{servicesProvider?.name} - Available Services</DialogTitle>
            <DialogDescription>Services available from this provider's API</DialogDescription>
          </DialogHeader>
          <DataTable
            columns={staticServiceColumns}
            data={servicesData?.services ?? []}
            isLoading={servicesLoading}
            emptyMessage="No services available from this provider"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
