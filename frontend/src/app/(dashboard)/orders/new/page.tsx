'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useService, useCatalog } from '@/hooks/use-catalog';
import { useCreateOrder } from '@/hooks/use-orders';
import { useBalance } from '@/hooks/use-balance';
import { ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils';
import { sanitizeInput } from '@/lib/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState, useMemo } from 'react';

const dripFeedIntervals = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '360', label: '6 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '24 hours' },
  { value: '2880', label: '48 hours' },
];

const orderSchema = z.object({
  serviceId: z.uuid('Please select a service'),
  link: z.url('Please enter a valid URL'),
  quantity: z.number().int().min(1, 'Minimum quantity is 1'),
  comments: z.string().max(500).optional(),
  couponCode: z.string().optional(),
  isDripFeed: z.boolean(),
  dripFeedRuns: z.number().int().min(2).max(100).optional(),
  dripFeedInterval: z.number().int().min(10).max(10080).optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

function NewOrderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedServiceId = searchParams.get('serviceId') ?? '';
  const [selectedServiceId, setSelectedServiceId] = useState(preselectedServiceId);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<OrderForm | null>(null);
  const createOrder = useCreateOrder();

  const { data: service } = useService(selectedServiceId);
  const { data: catalogData } = useCatalog({ limit: 100 });
  const { data: balance } = useBalance();

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      serviceId: preselectedServiceId,
      link: '',
      quantity: service?.minQuantity ?? 100,
      comments: '',
      couponCode: '',
      isDripFeed: false,
      dripFeedRuns: undefined,
      dripFeedInterval: undefined,
    },
  });

  const watchQuantity = form.watch('quantity');
  const watchIsDripFeed = form.watch('isDripFeed');
  const watchDripFeedRuns = form.watch('dripFeedRuns');

  // Memoize expensive calculations
  const estimatedPrice = useMemo(() => {
    return service ? (watchQuantity / 1000) * service.pricePer1000 : 0;
  }, [service, watchQuantity]);

  const chunkSize = useMemo(() => {
    return watchDripFeedRuns ? Math.ceil(watchQuantity / watchDripFeedRuns) : 0;
  }, [watchQuantity, watchDripFeedRuns]);

  const insufficientBalance = balance ? estimatedPrice > balance.available : false;

  const onSubmit = (data: OrderForm) => {
    if (data.isDripFeed && (!data.dripFeedRuns || !data.dripFeedInterval)) {
      form.setError('dripFeedRuns', { message: 'Drip-feed requires runs and interval' });
      return;
    }
    setPendingData(data);
    setShowConfirm(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!pendingData) return;
    try {
      const sanitizedLink = sanitizeInput(pendingData.link);
      const sanitizedComments = sanitizeInput(pendingData.comments);

      const payload = {
        serviceId: pendingData.serviceId,
        link: sanitizedLink,
        quantity: pendingData.quantity,
        comments: sanitizedComments,
        ...(pendingData.couponCode ? { couponCode: pendingData.couponCode } : {}),
        ...(pendingData.isDripFeed
          ? {
              isDripFeed: true,
              dripFeedRuns: pendingData.dripFeedRuns,
              dripFeedInterval: pendingData.dripFeedInterval,
            }
          : {}),
      };
      const result = await createOrder.mutateAsync(payload);
      toast.success('Order created successfully');
      router.push(`/orders/${result.orderId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create order');
      }
    } finally {
      setShowConfirm(false);
      setPendingData(null);
    }
  };

  const getIntervalLabel = (minutes: number) => {
    const item = dripFeedIntervals.find((i) => i.value === String(minutes));
    return item?.label ?? `${minutes} min`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to orders">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Order</h1>
          <p className="text-muted-foreground">Create a new service order</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Fill in the details for your order</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setSelectedServiceId(val);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {catalogData?.services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              {s.name}
                              <PlatformBadge platform={s.platform} />
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/watch?v=…" {...field} />
                    </FormControl>
                    <FormDescription>URL of the content to promote</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          field.onChange(Number.isNaN(v) ? undefined : v);
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    {service && (
                      <FormDescription>
                        Min: {service.minQuantity.toLocaleString()} — Max:{' '}
                        {service.maxQuantity.toLocaleString()}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any special instructions…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="couponCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coupon Code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter coupon code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isDripFeed"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Drip-feed</FormLabel>
                      <FormDescription>
                        Splits your order into smaller batches delivered over time, making growth
                        look more natural
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchIsDripFeed && (
                <div className="space-y-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="dripFeedRuns"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Runs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={2}
                            max={100}
                            placeholder="e.g. 5"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const v = e.target.valueAsNumber;
                              field.onChange(Number.isNaN(v) ? undefined : v);
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>How many times to deliver (2-100)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dripFeedInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval Between Runs</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : ''}
                          onValueChange={(val) => field.onChange(Number(val))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dripFeedIntervals.map((interval) => (
                              <SelectItem key={interval.value} value={interval.value}>
                                {interval.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {service && (
                <div className="rounded-md bg-muted p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated Price</span>
                    <span className="text-lg font-bold">{formatCurrency(estimatedPrice)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(service.pricePer1000)} per 1,000
                  </p>
                  {balance && (
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-xs text-muted-foreground">Available Balance</span>
                      <span
                        className={`text-sm font-medium ${insufficientBalance ? 'text-destructive' : ''}`}
                      >
                        {formatCurrency(balance.available)}
                      </span>
                    </div>
                  )}
                  {insufficientBalance && (
                    <p className="text-xs text-destructive">
                      Insufficient balance.{' '}
                      <Link href="/billing/deposit" className="underline">
                        Add funds
                      </Link>
                    </p>
                  )}
                  {watchIsDripFeed && watchDripFeedRuns && form.watch('dripFeedInterval') && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                      {watchDripFeedRuns} runs of {chunkSize.toLocaleString()} every{' '}
                      {getIntervalLabel(form.watch('dripFeedInterval')!)}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={createOrder.isPending || insufficientBalance}
              >
                {createOrder.isPending ? 'Creating…' : 'Create Order'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Order"
        description={`You're about to order ${pendingData?.quantity?.toLocaleString() ?? 0} units for ${formatCurrency(estimatedPrice)}.${balance ? ` Your balance after: ${formatCurrency(balance.available - estimatedPrice)}.` : ''}`}
        confirmLabel="Place Order"
        variant="default"
        onConfirm={handleConfirmedSubmit}
        isLoading={createOrder.isPending}
      />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense>
      <NewOrderForm />
    </Suspense>
  );
}
