'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { getProviderServices } from '@/lib/api/admin';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import type { ProviderServiceItem } from '@/lib/api/types';

interface ProviderOption {
  providerId: string;
  name: string;
}

interface ServicePanelAddFormProps {
  providers: ProviderOption[];
  /** Provider ids already attached to this service — hidden from the picker. */
  attachedProviderIds: string[];
  isSubmitting: boolean;
  onSubmit: (input: { providerId: string; externalServiceId: string }) => void;
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

function ExternalServiceCombobox({
  services,
  isLoading,
  externalServiceId,
  onSelect,
}: {
  services?: ProviderServiceItem[];
  isLoading: boolean;
  externalServiceId: string;
  onSelect: (svc: ProviderServiceItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    if (!services?.length || search.length < 2) return [];
    return filterAndGroup(services, search);
  }, [services, search]);

  const selected = services?.find((s) => s.serviceId === externalServiceId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading services…</p>;
  }
  if (!services?.length) {
    return (
      <p className="text-sm text-destructive">
        Could not load services from this provider. Check its API key and endpoint.
      </p>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected ? selected.name : 'Search services…'}</span>
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
          <CommandList className="max-h-[300px]">
            {search.length < 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search…
              </p>
            ) : grouped.length === 0 ? (
              <CommandEmpty>No services found.</CommandEmpty>
            ) : (
              grouped.map(([category, items]) => (
                <CommandGroup key={category} heading={category}>
                  {items.map((svc) => (
                    <CommandItem
                      key={svc.serviceId}
                      value={svc.serviceId}
                      onSelect={() => {
                        onSelect(svc);
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
                          #{svc.serviceId} | ${svc.rate}/1k | Min: {svc.min} | Max: {svc.max}
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
  );
}

export function ServicePanelAddForm({
  providers,
  attachedProviderIds,
  isSubmitting,
  onSubmit,
}: Readonly<ServicePanelAddFormProps>) {
  const [providerId, setProviderId] = useState('');
  const [externalServiceId, setExternalServiceId] = useState('');

  const available = providers.filter((p) => !attachedProviderIds.includes(p.providerId));

  const { data: providerServices, isLoading } = useQuery({
    queryKey: queryKeys.providerServices(providerId),
    queryFn: () => getProviderServices(providerId),
    enabled: !!providerId,
    retry: false,
  });

  const reset = () => {
    setProviderId('');
    setExternalServiceId('');
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Add a panel</p>

      <div className="space-y-1.5">
        <Label>Provider</Label>
        <Select
          value={providerId}
          onValueChange={(v) => {
            setProviderId(v);
            setExternalServiceId('');
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                All providers are already attached
              </div>
            ) : (
              available.map((p) => (
                <SelectItem key={p.providerId} value={p.providerId}>
                  {p.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {providerId && (
        <div className="space-y-1.5">
          <Label>Provider Service</Label>
          <ExternalServiceCombobox
            services={providerServices?.services}
            isLoading={isLoading}
            externalServiceId={externalServiceId}
            onSelect={(svc) => setExternalServiceId(svc.serviceId)}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={!providerId || !externalServiceId || isSubmitting}
          onClick={() => {
            onSubmit({ providerId, externalServiceId });
            reset();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {isSubmitting ? 'Adding…' : 'Add panel'}
        </Button>
      </div>
    </div>
  );
}
