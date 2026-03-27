'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { Platform, ServiceType, ProviderServiceItem } from '@/lib/api/types';

const platformOptions: Platform[] = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK'];
const typeOptions: ServiceType[] = ['VIEWS', 'SUBSCRIBERS', 'LIKES', 'COMMENTS', 'SHARES'];

export interface ServiceFormData {
  name: string;
  description: string;
  platform: Platform;
  type: ServiceType;
  pricePer1000: string;
  minQuantity: string;
  maxQuantity: string;
  providerId: string;
  externalServiceId: string;
}

export const defaultServiceForm: ServiceFormData = {
  name: '',
  description: '',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: '',
  minQuantity: '100',
  maxQuantity: '100000',
  providerId: '',
  externalServiceId: '',
};

interface ServiceFormProps {
  form: ServiceFormData;
  onUpdateField: (key: keyof ServiceFormData, value: string) => void;
  onSelectProviderService: (svc: ProviderServiceItem) => void;
  providers?: Array<{ providerId: string; name: string }>;
  providerServices?: ProviderServiceItem[];
  providerServicesLoading?: boolean;
  isSubmitting?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
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
      <div className="space-y-2">
        <Label>Provider Service</Label>
        <p className="text-sm text-muted-foreground">Select a provider first</p>
      </div>
    );
  }

  if (providerServicesLoading) {
    return (
      <div className="space-y-2">
        <Label>Provider Service</Label>
        <p className="text-sm text-muted-foreground">Loading services...</p>
      </div>
    );
  }

  if (!providerServices?.length) {
    return (
      <div className="space-y-2">
        <Label>Provider Service</Label>
        <p className="text-sm text-destructive">
          Could not load services from provider. Check API key and endpoint.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Provider Service ({providerServices.length} services)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selectedService ? selectedService.name : 'Search services...'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or category..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[400px]">
              {search.length < 2 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search...
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
    </div>
  );
}

export function ServiceForm({
  form,
  onUpdateField,
  onSelectProviderService,
  providers = [],
  providerServices,
  providerServicesLoading = false,
  isSubmitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Readonly<ServiceFormProps>) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select value={form.providerId} onValueChange={(v) => onUpdateField('providerId', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.providerId} value={p.providerId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProviderServiceCombobox
        providerId={form.providerId}
        externalServiceId={form.externalServiceId}
        providerServices={providerServices}
        providerServicesLoading={providerServicesLoading}
        onSelectProviderService={onSelectProviderService}
      />

      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => onUpdateField('name', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => onUpdateField('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={form.platform} onValueChange={(v) => onUpdateField('platform', v)}>
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
          <Select value={form.type} onValueChange={(v) => onUpdateField('type', v)}>
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

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Price per 1000</Label>
          <Input
            type="number"
            step="0.01"
            value={form.pricePer1000}
            onChange={(e) => onUpdateField('pricePer1000', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Min Quantity</Label>
          <Input
            type="number"
            value={form.minQuantity}
            onChange={(e) => onUpdateField('minQuantity', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Max Quantity</Label>
          <Input
            type="number"
            value={form.maxQuantity}
            onChange={(e) => onUpdateField('maxQuantity', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
