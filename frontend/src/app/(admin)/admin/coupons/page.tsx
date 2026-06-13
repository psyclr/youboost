'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminListCoupons, adminCreateCoupon, adminDeleteCoupon } from '@/lib/api/coupons';
import type { CouponResponse, CreateCouponInput } from '@/lib/api/coupons';
import { getErrorMessage } from '@/lib/api/error-messages';
import { queryKeys } from '@/lib/query-keys';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
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
import {
  couponFormSchema,
  defaultCouponFormValues,
  type CouponFormValues,
} from '@/lib/validation/admin-forms';

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
      aria-label="Delete coupon"
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

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: defaultCouponFormValues,
  });

  const discountType = form.watch('discountType');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminCoupons.list({ page }),
    queryFn: () => adminListCoupons({ page }),
  });

  const createMutation = useMutation({
    mutationFn: (values: CouponFormValues) => {
      const input: CreateCouponInput = {
        code: values.code,
        discountType: values.discountType,
        discountValue: Number.parseFloat(values.discountValue),
      };
      if (values.maxUses) input.maxUses = Number.parseInt(values.maxUses, 10);
      if (values.minOrderAmount) input.minOrderAmount = Number.parseFloat(values.minOrderAmount);
      if (values.expiresAt) input.expiresAt = new Date(values.expiresAt).toISOString();
      return adminCreateCoupon(input);
    },
    onSuccess: () => {
      toast.success('Coupon created');
      setCreateOpen(false);
      form.reset(defaultCouponFormValues);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to create coupon'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated');
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons.all });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to deactivate coupon'));
    },
  });

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
            if (!open) form.reset(defaultCouponFormValues);
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
            <Form {...form}>
              <form
                noValidate
                onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SUMMER2026"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                            <SelectItem value="FIXED">Fixed ($)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Discount Value {discountType === 'PERCENTAGE' ? '(%)' : '($)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={discountType === 'PERCENTAGE' ? '1' : '0.01'}
                            min="0"
                            max={discountType === 'PERCENTAGE' ? '100' : undefined}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Uses (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" placeholder="Unlimited" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minOrderAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Order Amount (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="No minimum"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date (optional)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
