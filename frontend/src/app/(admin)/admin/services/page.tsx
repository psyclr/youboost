'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAdminServices,
  createAdminService,
  updateAdminService,
  getProviders,
  getProviderServices,
} from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { ServiceTable } from '@/components/admin/service-table';
import {
  ServiceForm,
  defaultServiceForm,
  type ServiceFormData,
} from '@/components/admin/service-form';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminServiceResponse, ProviderServiceItem } from '@/lib/api/types';

function BrowseSelectCell({
  row,
  onSelect,
}: Readonly<{
  row: ProviderServiceItem;
  onSelect: (svc: ProviderServiceItem) => void;
}>) {
  return (
    <Button variant="outline" size="sm" onClick={() => onSelect(row)}>
      Select
    </Button>
  );
}

const staticBrowseColumns: Column<ProviderServiceItem>[] = [
  { header: 'ID', accessorKey: 'serviceId' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'Category', accessorKey: 'category' },
  {
    header: 'Rate',
    cell: (row: ProviderServiceItem) => `$${row.rate}`,
  },
  { header: 'Min', accessorKey: 'min' },
  { header: 'Max', accessorKey: 'max' },
];

function buildBrowseColumns(
  onSelect: (svc: ProviderServiceItem) => void,
): Column<ProviderServiceItem>[] {
  return [
    ...staticBrowseColumns,
    {
      header: '',
      cell: (row: ProviderServiceItem) => <BrowseSelectCell row={row} onSelect={onSelect} />,
      className: 'w-24',
    },
  ];
}

export default function AdminServicesPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<AdminServiceResponse | null>(null);
  const [form, setForm] = useState<ServiceFormData>(defaultServiceForm);
  const [browseOpen, setBrowseOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', { page }],
    queryFn: () => getAdminServices({ page, limit: 20 }),
  });

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => getProviders({ limit: 100 }),
  });

  const {
    data: providerServicesData,
    isLoading: providerServicesLoading,
    error: providerServicesError,
  } = useQuery({
    queryKey: ['provider-services', form.providerId],
    queryFn: () => getProviderServices(form.providerId),
    enabled: !!form.providerId && browseOpen,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (formData: ServiceFormData) =>
      createAdminService({
        name: formData.name,
        description: formData.description || undefined,
        platform: formData.platform,
        type: formData.type,
        pricePer1000: Number.parseFloat(formData.pricePer1000),
        minQuantity: Number.parseInt(formData.minQuantity, 10),
        maxQuantity: Number.parseInt(formData.maxQuantity, 10),
        providerId: formData.providerId,
        externalServiceId: formData.externalServiceId,
      }),
    onSuccess: () => {
      toast.success('Service created');
      setCreateOpen(false);
      setForm(defaultServiceForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create service');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: updateData }: { id: string; data: Record<string, unknown> }) =>
      updateAdminService(id, updateData),
    onSuccess: () => {
      toast.success('Service updated');
      setEditService(null);
      setForm(defaultServiceForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update service');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (service: AdminServiceResponse) =>
      updateAdminService(service.serviceId, { isActive: !service.isActive }),
    onSuccess: () => {
      toast.success('Service status updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
    },
  });

  const openEdit = (service: AdminServiceResponse) => {
    setEditService(service);
    setForm({
      name: service.name,
      description: service.description ?? '',
      platform: service.platform,
      type: service.type,
      pricePer1000: String(service.pricePer1000),
      minQuantity: String(service.minQuantity),
      maxQuantity: String(service.maxQuantity),
      providerId: service.providerId ?? '',
      externalServiceId: service.externalServiceId ?? '',
    });
  };

  const updateField = (key: keyof ServiceFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectProviderService = (svc: ProviderServiceItem) => {
    setForm((prev) => ({
      ...prev,
      externalServiceId: svc.serviceId,
      name: prev.name || svc.name,
      minQuantity: String(svc.min),
      maxQuantity: String(svc.max),
      pricePer1000: String(svc.rate),
    }));
    setBrowseOpen(false);
  };

  const handleCreateSubmit = () => {
    if (!form.name || !form.pricePer1000 || !form.providerId || !form.externalServiceId) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate(form);
  };

  const handleEditSubmit = () => {
    if (!editService) return;

    const updates: Record<string, unknown> = {};
    if (form.name !== editService.name) updates.name = form.name;
    if (form.description !== editService.description)
      updates.description = form.description || null;
    if (form.platform !== editService.platform) updates.platform = form.platform;
    if (form.type !== editService.type) updates.type = form.type;
    if (Number.parseFloat(form.pricePer1000) !== editService.pricePer1000) {
      updates.pricePer1000 = Number.parseFloat(form.pricePer1000);
    }
    if (Number.parseInt(form.minQuantity, 10) !== editService.minQuantity) {
      updates.minQuantity = Number.parseInt(form.minQuantity, 10);
    }
    if (Number.parseInt(form.maxQuantity, 10) !== editService.maxQuantity) {
      updates.maxQuantity = Number.parseInt(form.maxQuantity, 10);
    }
    if (form.providerId !== editService.providerId) {
      updates.providerId = form.providerId;
    }
    if (form.externalServiceId !== editService.externalServiceId) {
      updates.externalServiceId = form.externalServiceId;
    }

    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      return;
    }

    updateMutation.mutate({ id: editService.serviceId, data: updates });
  };

  const browseColumns = buildBrowseColumns(selectProviderService);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage service offerings</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Service</DialogTitle>
              <DialogDescription>Add a new service offering</DialogDescription>
            </DialogHeader>
            <ServiceForm
              form={form}
              onUpdateField={updateField}
              onBrowseProviderServices={() => setBrowseOpen(true)}
              providers={providersData?.providers}
              isSubmitting={createMutation.isPending}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setCreateOpen(false);
                setForm(defaultServiceForm);
              }}
              submitLabel="Create"
            />
          </DialogContent>
        </Dialog>
      </div>

      <ServiceTable
        services={data?.services ?? []}
        isLoading={isLoading}
        onEdit={openEdit}
        onToggleStatus={(service) => toggleStatusMutation.mutate(service)}
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

      {/* Edit Dialog */}
      <Dialog open={!!editService} onOpenChange={(open) => !open && setEditService(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service details</DialogDescription>
          </DialogHeader>
          <ServiceForm
            form={form}
            onUpdateField={updateField}
            onBrowseProviderServices={() => setBrowseOpen(true)}
            providers={providersData?.providers}
            isSubmitting={updateMutation.isPending}
            onSubmit={handleEditSubmit}
            onCancel={() => {
              setEditService(null);
              setForm(defaultServiceForm);
            }}
            submitLabel="Update"
          />
        </DialogContent>
      </Dialog>

      {/* Browse Provider Services Dialog */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Browse Provider Services</DialogTitle>
            <DialogDescription>
              Select a service from{' '}
              {providersData?.providers.find((p) => p.providerId === form.providerId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            {providerServicesError ? (
              <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-md space-y-2">
                <p className="font-medium">Failed to fetch services from provider</p>
                {providerServicesError instanceof ApiError && (
                  <p className="text-muted-foreground">{providerServicesError.message}</p>
                )}
                <p className="text-muted-foreground">
                  Make sure the provider has a valid API key configured. You can close this dialog
                  and enter the External Service ID manually.
                </p>
              </div>
            ) : (
              <DataTable
                columns={browseColumns}
                data={providerServicesData?.services ?? []}
                isLoading={providerServicesLoading}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
