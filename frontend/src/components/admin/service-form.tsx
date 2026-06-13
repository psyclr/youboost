'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { serviceFormSchema, type ServiceFormValues } from '@/lib/validation/admin-forms';
import type { Platform, ServiceType, ProviderServiceItem } from '@/lib/api/types';

export {
  serviceFormSchema,
  defaultServiceFormValues,
  type ServiceFormValues,
} from '@/lib/validation/admin-forms';

const platformOptions: Platform[] = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK'];
const typeOptions: ServiceType[] = ['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES'];

interface ServiceFormProps {
  /** Initial field values; the form resets to these when they change identity. */
  values: ServiceFormValues;
  onSubmit: (values: ServiceFormValues) => void;
  onCancel: () => void;
  /** Reported upward so the page can fetch services for the chosen provider. */
  onProviderChange?: (providerId: string) => void;
  providers?: Array<{ providerId: string; name: string }>;
  providerServices?: ProviderServiceItem[];
  providerServicesLoading?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const MAX_VISIBLE_ITEMS = 50;

function filterAndGroup(
  services: ProviderServiceItem[],
  query: string,
): [string, ProviderServiceItem[]][] {
  const q = query.toLowerCase().trim();
  const filtered = services.filter(
    (svc) => svc.name.toLowerCase().includes(q) || svc.category.toLowerCase().includes(q),
  );
  const map = new Map<string, ProviderServiceItem[]>();
  let count = 0;
  for (const svc of filtered) {
    if (count >= MAX_VISIBLE_ITEMS) break;
    const cat = svc.category || 'Other';
    const list = map.get(cat);
    if (list) list.push(svc);
    else map.set(cat, [svc]);
    count++;
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function ProviderServiceCombobox({
  providerId,
  externalServiceId,
  providerServices,
  providerServicesLoading,
  onSelectProviderService,
}: {
  providerId: string;
  externalServiceId: string;
  providerServices?: ProviderServiceItem[];
  providerServicesLoading: boolean;
  onSelectProviderService: (svc: ProviderServiceItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    if (!providerServices?.length || search.length < 2) return [];
    return filterAndGroup(providerServices, search);
  }, [providerServices, search]);

  const selectedService = providerServices?.find((s) => s.serviceId === externalServiceId);

  if (!providerId) {
    return (
      <FormItem>
        <FormLabel>Provider Service</FormLabel>
        <p className="text-sm text-muted-foreground">Select a provider first</p>
      </FormItem>
    );
  }

  if (providerServicesLoading) {
    return (
      <FormItem>
        <FormLabel>Provider Service</FormLabel>
        <p className="text-sm text-muted-foreground">Loading services…</p>
      </FormItem>
    );
  }

  if (!providerServices?.length) {
    return (
      <FormItem>
        <FormLabel>Provider Service</FormLabel>
        <p className="text-sm text-destructive">
          Could not load services from provider. Check API key and endpoint.
        </p>
      </FormItem>
    );
  }

  return (
    <FormItem>
      <FormLabel>Provider Service ({providerServices.length} services)</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selectedService ? selectedService.name : 'Search services…'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or category…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[400px]">
              {search.length < 2 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search…
                </p>
              ) : grouped.length === 0 ? (
                <CommandEmpty>No services found.</CommandEmpty>
              ) : (
                grouped.map(([category, services]) => (
                  <CommandGroup key={category} heading={category}>
                    {services.map((svc) => (
                      <CommandItem
                        key={svc.serviceId}
                        value={svc.serviceId}
                        onSelect={() => {
                          onSelectProviderService(svc);
                          setOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            externalServiceId === svc.serviceId ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{svc.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ${svc.rate}/1k | Min: {svc.min} | Max: {svc.max}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormItem>
  );
}

export function ServiceForm({
  values,
  onSubmit,
  onCancel,
  onProviderChange,
  providers = [],
  providerServices,
  providerServicesLoading = false,
  isSubmitting = false,
  submitLabel = 'Save',
}: Readonly<ServiceFormProps>) {
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    values,
    resetOptions: { keepDirtyValues: false },
  });

  const providerId = form.watch('providerId');
  const externalServiceId = form.watch('externalServiceId');

  const selectProviderService = (svc: ProviderServiceItem) => {
    form.setValue('externalServiceId', svc.serviceId, { shouldValidate: true });
    if (!form.getValues('name')) {
      form.setValue('name', svc.name, { shouldValidate: true });
    }
    form.setValue('minQuantity', String(svc.min), { shouldValidate: true });
    form.setValue('maxQuantity', String(svc.max), { shouldValidate: true });
    form.setValue('pricePer1000', String(svc.rate), { shouldValidate: true });
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="providerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Provider</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  onProviderChange?.(v);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.providerId} value={p.providerId}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-1">
          <ProviderServiceCombobox
            providerId={providerId}
            externalServiceId={externalServiceId}
            providerServices={providerServices}
            providerServicesLoading={providerServicesLoading}
            onSelectProviderService={selectProviderService}
          />
          {form.formState.errors.externalServiceId && (
            <p className="text-sm text-destructive">
              {form.formState.errors.externalServiceId.message}
            </p>
          )}
        </div>

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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {platformOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
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
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="pricePer1000"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per 1000</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min Quantity</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Quantity</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
