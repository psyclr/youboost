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
  defaultServiceFormValues,
  type ServiceFormValues,
} from '@/components/admin/service-form';
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
import type { AdminServiceResponse, AdminServiceUpdateInput } from '@/lib/api/types';

function serviceToFormValues(service: AdminServiceResponse): ServiceFormValues {
  return {
    name: service.name,
    description: service.description ?? '',
    platform: service.platform as ServiceFormValues['platform'],
    type: service.type as ServiceFormValues['type'],
    pricePer1000: String(service.pricePer1000),
    minQuantity: String(service.minQuantity),
    maxQuantity: String(service.maxQuantity),
    providerId: service.providerId ?? '',
    externalServiceId: service.externalServiceId ?? '',
  };
}

export default function AdminServicesPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<AdminServiceResponse | null>(null);
  // Provider currently selected in whichever dialog is open, used to fetch
  // that provider's services. Each dialog reports its provider up via the form.
  const [activeProviderId, setActiveProviderId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', { page }],
    queryFn: () => getAdminServices({ page, limit: 20 }),
  });

  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => getProviders({ limit: 100 }),
  });

  const { data: providerServicesData, isLoading: providerServicesLoading } = useQuery({
    queryKey: ['provider-services', activeProviderId],
    queryFn: () => getProviderServices(activeProviderId),
    enabled: !!activeProviderId,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (values: ServiceFormValues) =>
      createAdminService({
        name: values.name,
        description: values.description || undefined,
        platform: values.platform,
        type: values.type,
        pricePer1000: Number.parseFloat(values.pricePer1000),
        minQuantity: Number.parseInt(values.minQuantity, 10),
        maxQuantity: Number.parseInt(values.maxQuantity, 10),
        providerId: values.providerId,
        externalServiceId: values.externalServiceId,
      }),
    onSuccess: () => {
      toast.success('Service created');
      setCreateOpen(false);
      setActiveProviderId('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create service');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: updateData }: { id: string; data: AdminServiceUpdateInput }) =>
      updateAdminService(id, updateData),
    onSuccess: () => {
      toast.success('Service updated');
      setEditService(null);
      setActiveProviderId('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update status');
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
    setActiveProviderId(service.providerId ?? '');
  };

  const handleCreateSubmit = (values: ServiceFormValues) => {
    createMutation.mutate(values);
  };

  const handleEditSubmit = (values: ServiceFormValues) => {
    if (!editService) return;

    const updates: AdminServiceUpdateInput = {};
    if (values.name !== editService.name) updates.name = values.name;
    // Send '' to clear: backend adminServiceUpdateSchema.description is
    // z.string().optional() and rejects null, while buildUpdateData writes any
    // non-null value (so '' clears the column). Compare against '' for the
    // null/empty stored case so an unchanged empty description is not resent.
    if (values.description !== (editService.description ?? '')) {
      updates.description = values.description;
    }
    if (values.platform !== editService.platform) updates.platform = values.platform;
    if (values.type !== editService.type) updates.type = values.type;
    const price = Number.parseFloat(values.pricePer1000);
    if (price !== editService.pricePer1000) updates.pricePer1000 = price;
    const min = Number.parseInt(values.minQuantity, 10);
    if (min !== editService.minQuantity) updates.minQuantity = min;
    const max = Number.parseInt(values.maxQuantity, 10);
    if (max !== editService.maxQuantity) updates.maxQuantity = max;
    if (values.providerId !== (editService.providerId ?? '')) {
      updates.providerId = values.providerId;
    }
    if (values.externalServiceId !== (editService.externalServiceId ?? '')) {
      updates.externalServiceId = values.externalServiceId;
    }

    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      return;
    }

    updateMutation.mutate({ id: editService.serviceId, data: updates });
  };

  const sharedFormProps = {
    onProviderChange: setActiveProviderId,
    providers: providersData?.providers,
    providerServices: providerServicesData?.services,
    providerServicesLoading,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage service offerings</p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setActiveProviderId('');
          }}
        >
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
              {...sharedFormProps}
              values={defaultServiceFormValues}
              isSubmitting={createMutation.isPending}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setCreateOpen(false);
                setActiveProviderId('');
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
      <Dialog
        open={!!editService}
        onOpenChange={(open) => {
          if (!open) {
            setEditService(null);
            setActiveProviderId('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service details</DialogDescription>
          </DialogHeader>
          {editService && (
            <ServiceForm
              {...sharedFormProps}
              values={serviceToFormValues(editService)}
              isSubmitting={updateMutation.isPending}
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setEditService(null);
                setActiveProviderId('');
              }}
              submitLabel="Update"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
