'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProviders,
  createProvider,
  updateProvider,
  deactivateProvider,
  getProviderServices,
  getProviderBalance,
} from '@/lib/api/admin';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Pencil, Wallet, List } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildProviderFormSchema,
  defaultProviderFormValues,
  type ProviderFormValues,
} from '@/lib/validation/admin-forms';
import type { ProviderResponse, ProviderServiceItem } from '@/lib/api/types';

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
  onToggleActive: (provider: ProviderResponse) => void;
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
      <Button variant="ghost" size="sm" onClick={() => callbacks.onToggleActive(row)}>
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

interface ProviderFormFieldsProps {
  form: ReturnType<typeof useForm<ProviderFormValues>>;
  mode: 'create' | 'edit';
}

function ProviderFormFields({ form, mode }: Readonly<ProviderFormFieldsProps>) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="apiEndpoint"
        render={({ field }) => (
          <FormItem>
            <FormLabel>API Endpoint</FormLabel>
            <FormControl>
              <Input placeholder="https://provider-api.com/v1" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="apiKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>API Key</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder={mode === 'edit' ? 'Leave empty to keep current' : ''}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="priority"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Priority</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormDescription>Higher priority providers are selected first.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export default function AdminProvidersPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderResponse | null>(null);
  const [servicesProvider, setServicesProvider] = useState<ProviderResponse | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ProviderResponse | null>(null);
  const [checkingBalanceId, setCheckingBalanceId] = useState<string | null>(null);

  const createForm = useForm<ProviderFormValues>({
    resolver: zodResolver(buildProviderFormSchema('create')),
    defaultValues: defaultProviderFormValues,
  });

  const editForm = useForm<ProviderFormValues>({
    resolver: zodResolver(buildProviderFormSchema('edit')),
    defaultValues: defaultProviderFormValues,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminProviders.list({ page }),
    queryFn: () => getProviders({ page, limit: 20 }),
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.providerServices(servicesProvider?.providerId),
    queryFn: () => getProviderServices(servicesProvider!.providerId),
    enabled: !!servicesProvider,
  });

  const createMutation = useMutation({
    mutationFn: (values: ProviderFormValues) =>
      createProvider({
        name: values.name,
        apiEndpoint: values.apiEndpoint,
        apiKey: values.apiKey,
        priority: Number.parseInt(values.priority, 10) || 0,
      }),
    onSuccess: () => {
      toast.success('Provider created');
      setCreateOpen(false);
      createForm.reset(defaultProviderFormValues);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create provider'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: Record<string, unknown> }) => {
      await updateProvider(id, updateData);
    },
    onSuccess: () => {
      toast.success('Provider updated');
      setEditProvider(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to update provider'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateProvider(id),
    onSuccess: () => {
      toast.success('Provider deactivated');
      setDeactivateTarget(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProviders.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to deactivate provider'));
    },
  });

  const handleCheckBalance = async (providerId: string) => {
    setCheckingBalanceId(providerId);
    try {
      const result = await getProviderBalance(providerId);
      toast.success(`Balance: ${result.currency} ${result.balance.toFixed(2)}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to check balance'));
    } finally {
      setCheckingBalanceId(null);
    }
  };

  const openEdit = (provider: ProviderResponse) => {
    setEditProvider(provider);
    editForm.reset({
      name: provider.name,
      apiEndpoint: provider.apiEndpoint,
      apiKey: '',
      priority: String(provider.priority),
    });
  };

  const handleEditSubmit = (values: ProviderFormValues) => {
    if (!editProvider) return;
    const updateData: Record<string, unknown> = {
      name: values.name,
      apiEndpoint: values.apiEndpoint,
      priority: Number.parseInt(values.priority, 10) || 0,
    };
    if (values.apiKey) {
      updateData.apiKey = values.apiKey;
    }
    updateMutation.mutate({ id: editProvider.providerId, data: updateData });
  };

  const handleToggleActive = (provider: ProviderResponse) => {
    if (provider.isActive) {
      setDeactivateTarget(provider);
    } else {
      updateMutation.mutate({ id: provider.providerId, data: { isActive: true } });
    }
  };

  const columns = buildProviderColumns({
    onEdit: openEdit,
    onCheckBalance: handleCheckBalance,
    checkingBalanceId,
    onViewServices: setServicesProvider,
    onToggleActive: handleToggleActive,
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
            if (!open) createForm.reset(defaultProviderFormValues);
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
            <Form {...createForm}>
              <form
                noValidate
                onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
              >
                <ProviderFormFields form={createForm} mode="create" />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
          if (!open) setEditProvider(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update provider configuration</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form noValidate onSubmit={editForm.handleSubmit(handleEditSubmit)}>
              <ProviderFormFields form={editForm} mode="edit" />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
            <DialogDescription>Services available from this provider&apos;s API</DialogDescription>
          </DialogHeader>
          <DataTable
            columns={staticServiceColumns}
            data={servicesData?.services ?? []}
            isLoading={servicesLoading}
            emptyMessage="No services available from this provider"
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate Provider"
        description={
          deactivateTarget
            ? `Deactivate "${deactivateTarget.name}"? Services linked to this provider may stop working.`
            : ''
        }
        confirmLabel="Deactivate"
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.providerId)}
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
