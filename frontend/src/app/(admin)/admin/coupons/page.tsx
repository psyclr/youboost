'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminListCoupons, adminCreateCoupon, adminDeleteCoupon } from '@/lib/api/coupons';
import type { CouponResponse, CreateCouponInput } from '@/lib/api/coupons';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface CouponFormData {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  maxUses: string;
  minOrderAmount: string;
  expiresAt: string;
}

const defaultForm: CouponFormData = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxUses: '',
  minOrderAmount: '',
  expiresAt: '',
};

function CouponDeleteCell({
  row,
  onDelete,
}: Readonly<{
  row: CouponResponse;
  onDelete: (id: string) => void;
}>) {
  if (!row.isActive) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(row.id);
      }}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}

const staticColumns: Column<CouponResponse>[] = [
  {
    header: 'Code',
    cell: (row: CouponResponse) => <span className="font-mono font-medium">{row.code}</span>,
  },
  {
    header: 'Type',
    cell: (row: CouponResponse) => (
      <Badge variant="outline">{row.discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'}</Badge>
    ),
  },
  {
    header: 'Value',
    cell: (row: CouponResponse) =>
      row.discountType === 'PERCENTAGE'
        ? `${row.discountValue}%`
        : formatCurrency(row.discountValue),
  },
  {
    header: 'Uses',
    cell: (row: CouponResponse) =>
      row.maxUses == null ? `${row.usedCount} / Unlimited` : `${row.usedCount} / ${row.maxUses}`,
  },
  {
    header: 'Min Order',
    cell: (row: CouponResponse) =>
      row.minOrderAmount == null ? '-' : formatCurrency(row.minOrderAmount),
  },
  {
    header: 'Expires',
    cell: (row: CouponResponse) => (row.expiresAt ? formatDate(row.expiresAt) : 'Never'),
  },
  {
    header: 'Status',
    cell: (row: CouponResponse) => (
      <Badge variant={row.isActive ? 'default' : 'secondary'}>
        {row.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

function buildCouponColumns(onDelete: (id: string) => void): Column<CouponResponse>[] {
  return [
    ...staticColumns,
    {
      header: '',
      cell: (row: CouponResponse) => <CouponDeleteCell row={row} onDelete={onDelete} />,
      className: 'w-12',
    },
  ];
}

export default function AdminCouponsPage() {
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormData>(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'coupons', { page }],
    queryFn: () => adminListCoupons({ page }),
  });

  const createMutation = useMutation({
    mutationFn: (formData: CouponFormData) => {
      const input: CreateCouponInput = {
        code: formData.code,
        discountType: formData.discountType,
        discountValue: Number.parseFloat(formData.discountValue),
      };
      if (formData.maxUses) input.maxUses = Number.parseInt(formData.maxUses, 10);
      if (formData.minOrderAmount)
        input.minOrderAmount = Number.parseFloat(formData.minOrderAmount);
      if (formData.expiresAt) input.expiresAt = new Date(formData.expiresAt).toISOString();
      return adminCreateCoupon(input);
    },
    onSuccess: () => {
      toast.success('Coupon created');
      setCreateOpen(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create coupon');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to deactivate coupon');
    },
  });

  const updateField = (key: keyof CouponFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const columns = buildCouponColumns(setDeleteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">Manage discount coupons</p>
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
              <Tag className="h-4 w-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
              <DialogDescription>Create a new discount coupon</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  placeholder="SUMMER2026"
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={form.discountType}
                    onValueChange={(v) => updateField('discountType', v as 'PERCENTAGE' | 'FIXED')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                      <SelectItem value="FIXED">Fixed ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value {form.discountType === 'PERCENTAGE' ? '(%)' : '($)'}</Label>
                  <Input
                    type="number"
                    step={form.discountType === 'PERCENTAGE' ? '1' : '0.01'}
                    min="0"
                    max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                    value={form.discountValue}
                    onChange={(e) => updateField('discountValue', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Uses (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.maxUses}
                    onChange={(e) => updateField('maxUses', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Order Amount (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="No minimum"
                    value={form.minOrderAmount}
                    onChange={(e) => updateField('minOrderAmount', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expiration Date (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => updateField('expiresAt', e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.code || !form.discountValue || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
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
      {!isLoading && (!data?.coupons || data.coupons.length === 0) && (
        <EmptyState
          title="No coupons yet"
          description="Create your first coupon to offer discounts to customers"
        />
      )}
      {!isLoading && data?.coupons && data.coupons.length > 0 && (
        <DataTable
          columns={columns}
          data={data.coupons}
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
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Deactivate Coupon"
        description="This will deactivate the coupon. It can no longer be used for new orders."
        confirmLabel="Deactivate"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
