'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useService, useCatalog } from '@/hooks/use-catalog';
import { useCreateOrder } from '@/hooks/use-orders';
import { ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Suspense, useState } from 'react';

const orderSchema = z.object({
  serviceId: z.string().uuid('Please select a service'),
  link: z.string().url('Please enter a valid URL'),
  quantity: z.coerce.number().int().min(1, 'Minimum quantity is 1'),
  comments: z.string().max(500).optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

function NewOrderForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedServiceId = searchParams.get('serviceId') ?? '';
  const [selectedServiceId, setSelectedServiceId] = useState(preselectedServiceId);
  const createOrder = useCreateOrder();

  const { data: service } = useService(selectedServiceId);
  const { data: catalogData } = useCatalog({ limit: 100 });

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      serviceId: preselectedServiceId,
      link: '',
      quantity: service?.minQuantity ?? 100,
      comments: '',
    },
  });

  const watchQuantity = form.watch('quantity');
  const estimatedPrice = service ? (watchQuantity / 1000) * service.pricePer1000 : 0;

  const onSubmit = async (data: OrderForm) => {
    try {
      const result = await createOrder.mutateAsync(data);
      toast.success('Order created successfully');
      router.push(`/orders/${result.orderId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create order');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Order</h1>
        <p className="text-muted-foreground">Create a new service order</p>
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
                      <Input placeholder="https://youtube.com/watch?v=..." {...field} />
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
                      <Input type="number" {...field} />
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
                      <Textarea placeholder="Any special instructions..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {service && (
                <div className="rounded-md bg-muted p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated Price</span>
                    <span className="text-lg font-bold">{formatCurrency(estimatedPrice)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(service.pricePer1000)} per 1,000
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={createOrder.isPending}>
                {createOrder.isPending ? 'Creating...' : 'Create Order'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
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
