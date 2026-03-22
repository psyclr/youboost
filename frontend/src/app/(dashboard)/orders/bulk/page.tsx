'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCatalog } from '@/hooks/use-catalog';
import { useBulkOrders } from '@/hooks/use-orders';
import { ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils';
import { sanitizeInput } from '@/lib/utils/sanitize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ArrowLeft, CheckCircle, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import type { BulkOrderResult, CatalogService } from '@/lib/api/types';

const bulkSchema = z.object({
  serviceId: z.string().uuid('Please select a service'),
  linksText: z.string().min(1, 'Enter at least one link'),
  defaultQuantity: z.number().int().min(1, 'Minimum quantity is 1'),
  comments: z.string().max(500).optional(),
});

type BulkForm = z.infer<typeof bulkSchema>;

interface ParsedLink {
  link: string;
  valid: boolean;
}

export default function BulkOrderPage() {
  const [parsedLinks, setParsedLinks] = useState<ParsedLink[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<BulkOrderResult | null>(null);
  const [selectedService, setSelectedService] = useState<CatalogService | null>(null);
  const bulkOrders = useBulkOrders();

  const { data: catalogData } = useCatalog({ limit: 100 });

  const form = useForm<BulkForm>({
    resolver: zodResolver(bulkSchema),
    defaultValues: {
      serviceId: '',
      linksText: '',
      defaultQuantity: 1000,
      comments: '',
    },
  });

  const watchQuantity = form.watch('defaultQuantity');

  const handlePreview = () => {
    const linksText = form.getValues('linksText');
    const lines = linksText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const urlPattern = /^https?:\/\/.+/;
    const parsed = lines.map((line) => ({
      link: line,
      valid: urlPattern.test(line),
    }));

    setParsedLinks(parsed);
    setShowPreview(true);
    setResult(null);
  };

  const onSubmit = async (data: BulkForm) => {
    const validLinks = parsedLinks.filter((l) => l.valid);
    if (validLinks.length === 0) {
      toast.error('No valid links to submit');
      return;
    }

    try {
      // Sanitize comments before sending
      const sanitizedComments = sanitizeInput(data.comments);

      const res = await bulkOrders.mutateAsync({
        serviceId: data.serviceId,
        links: validLinks.map((l) => ({ link: sanitizeInput(l.link) })),
        defaultQuantity: data.defaultQuantity,
        comments: sanitizedComments,
      });
      setResult(res);
      toast.success(`${res.totalCreated} orders created, ${res.totalFailed} failed`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create bulk orders');
      }
    }
  };

  const validCount = parsedLinks.filter((l) => l.valid).length;
  const invalidCount = parsedLinks.filter((l) => !l.valid).length;

  // Memoize expensive calculations
  const estimatedTotal = useMemo(() => {
    return selectedService ? (watchQuantity / 1000) * selectedService.pricePer1000 * validCount : 0;
  }, [selectedService, watchQuantity, validCount]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Bulk Order</h1>
          <p className="text-muted-foreground">Create multiple orders at once</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Configuration</CardTitle>
          <CardDescription>Select a service and enter links to order</CardDescription>
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
                        const svc = catalogData?.services.find((s) => s.id === val) ?? null;
                        setSelectedService(svc);
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
                name="defaultQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Quantity (per link)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    {selectedService && (
                      <FormDescription>
                        Min: {selectedService.minQuantity.toLocaleString()} — Max:{' '}
                        {selectedService.maxQuantity.toLocaleString()}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linksText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Links</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          'https://youtube.com/watch?v=abc123\nhttps://youtube.com/watch?v=def456\nhttps://youtube.com/watch?v=ghi789'
                        }
                        rows={8}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Enter one link per line (up to 500 links)</FormDescription>
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
                      <Textarea placeholder="Any special instructions..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handlePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                {showPreview && validCount > 0 && !result && (
                  <Button type="submit" disabled={bulkOrders.isPending}>
                    {bulkOrders.isPending ? 'Creating Orders...' : `Create ${validCount} Orders`}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {showPreview && parsedLinks.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {validCount} valid link{validCount !== 1 ? 's' : ''}{' '}
              {invalidCount > 0 && (
                <span className="text-destructive">({invalidCount} invalid - will be skipped)</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedService && (
              <div className="rounded-md bg-muted p-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Total</span>
                <span className="text-lg font-bold">{formatCurrency(estimatedTotal)}</span>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {parsedLinks.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 border-b last:border-0"
                >
                  {item.valid ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="truncate">{item.link}</span>
                  {item.valid && selectedService && (
                    <span className="text-muted-foreground ml-auto shrink-0">
                      {formatCurrency((watchQuantity / 1000) * selectedService.pricePer1000)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {result.totalCreated} created, {result.totalFailed} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {result.results.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm py-1 border-b last:border-0"
                >
                  {item.status === 'success' ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Success
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                  <span className="truncate flex-1">{item.link}</span>
                  {item.orderId && (
                    <Link
                      href={`/orders/${item.orderId}`}
                      className="text-primary hover:underline text-xs font-mono shrink-0"
                    >
                      {item.orderId.slice(0, 8)}...
                    </Link>
                  )}
                  {item.error && (
                    <span className="text-destructive text-xs shrink-0">{item.error}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
