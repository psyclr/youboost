'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminServices, createAdminService, updateAdminService } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminServiceResponse, Platform, ServiceType } from '@/lib/api/types';

const platformOptions: Platform[] = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK'];
const typeOptions: ServiceType[] = ['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES'];

interface ServiceFormData {
  name: string;
  description: string;
  platform: Platform;
  type: ServiceType;
  pricePer1000: string;
  minQuantity: string;
  maxQuantity: string;
}

const defaultForm: ServiceFormData = {
  name: '',
  description: '',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: '',
  minQuantity: '100',
  maxQuantity: '100000',
};

export default function AdminServicesPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<AdminServiceResponse | null>(null);
  const [form, setForm] = useState<ServiceFormData>(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'services', { page }],
    queryFn: () => getAdminServices({ page, limit: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ServiceFormData) =>
      createAdminService({
        name: data.name,
        description: data.description || undefined,
        platform: data.platform,
        type: data.type,
        pricePer1000: parseFloat(data.pricePer1000),
        minQuantity: parseInt(data.minQuantity),
        maxQuantity: parseInt(data.maxQuantity),
      }),
    onSuccess: () => {
      toast.success('Service created');
      setCreateOpen(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create service');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateAdminService(id, data),
    onSuccess: () => {
      toast.success('Service updated');
      setEditService(null);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update service');
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
    });
  };

  const updateField = (key: keyof ServiceFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const serviceForm = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={form.platform} onValueChange={(v) => updateField('platform', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {platformOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => updateField('type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Price per 1000</Label>
        <Input
          type="number"
          step="0.01"
          value={form.pricePer1000}
          onChange={(e) => updateField('pricePer1000', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Min Quantity</Label>
          <Input
            type="number"
            value={form.minQuantity}
            onChange={(e) => updateField('minQuantity', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Quantity</Label>
          <Input
            type="number"
            value={form.maxQuantity}
            onChange={(e) => updateField('maxQuantity', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const columns: Column<AdminServiceResponse>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Platform',
      cell: (row) => <PlatformBadge platform={row.platform} />,
    },
    {
      header: 'Type',
      cell: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
    {
      header: 'Price/1K',
      cell: (row) => formatCurrency(row.pricePer1000),
    },
    {
      header: 'Range',
      cell: (row) => `${row.minQuantity.toLocaleString()} - ${row.maxQuantity.toLocaleString()}`,
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
      header: '',
      cell: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateMutation.mutate({
                id: row.serviceId,
                data: { isActive: !row.isActive },
              })
            }
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
      className: 'w-40',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground">Manage platform services</p>
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
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Service</DialogTitle>
              <DialogDescription>Add a new service to the catalog</DialogDescription>
            </DialogHeader>
            {serviceForm}
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.pricePer1000 || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={data?.services ?? []}
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

      <Dialog
        open={!!editService}
        onOpenChange={(open) => {
          if (!open) {
            setEditService(null);
            setForm(defaultForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service configuration</DialogDescription>
          </DialogHeader>
          {serviceForm}
          <DialogFooter>
            <Button
              onClick={() =>
                editService &&
                updateMutation.mutate({
                  id: editService.serviceId,
                  data: {
                    name: form.name,
                    description: form.description || undefined,
                    platform: form.platform,
                    type: form.type,
                    pricePer1000: parseFloat(form.pricePer1000),
                    minQuantity: parseInt(form.minQuantity),
                    maxQuantity: parseInt(form.maxQuantity),
                  },
                })
              }
              disabled={!form.name || !form.pricePer1000 || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
