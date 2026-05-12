'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  CatalogService,
  LandingTierGlow,
  LandingTierInput,
  LandingTierPill,
} from '@/lib/api/types';

const PILL_OPTIONS: { value: LandingTierPill | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'SALE', label: 'Sale' },
  { value: 'MEGA_FAST', label: 'Mega Fast' },
  { value: 'PREMIUM', label: 'Premium' },
];

const GLOW_OPTIONS: { value: LandingTierGlow | 'NONE'; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'ORANGE', label: 'Orange' },
  { value: 'COSMIC', label: 'Cosmic' },
  { value: 'PURPLE', label: 'Purple' },
];

export interface TierDraft {
  serviceId: string;
  order: number;
  pillKind: LandingTierPill | null;
  glowKind: LandingTierGlow | null;
  titleOverride: string;
  descOverride: string;
  priceOverride: string;
  unit: string;
}

export function tiersFromResponse(
  tiers: Array<{
    serviceId: string;
    order: number;
    pillKind: LandingTierPill | null;
    glowKind: LandingTierGlow | null;
    titleOverride: string | null;
    descOverride: string | null;
    priceOverride: number | null;
    unit: string;
  }>,
): TierDraft[] {
  return tiers.map((t) => ({
    serviceId: t.serviceId,
    order: t.order,
    pillKind: t.pillKind,
    glowKind: t.glowKind,
    titleOverride: t.titleOverride ?? '',
    descOverride: t.descOverride ?? '',
    priceOverride: t.priceOverride !== null ? String(t.priceOverride) : '',
    unit: t.unit || '1k',
  }));
}

export function tiersToPayload(drafts: TierDraft[]): LandingTierInput[] {
  return drafts.map((d) => ({
    serviceId: d.serviceId,
    order: d.order,
    pillKind: d.pillKind,
    glowKind: d.glowKind,
    titleOverride: d.titleOverride.trim() ? d.titleOverride.trim() : null,
    descOverride: d.descOverride.trim() ? d.descOverride.trim() : null,
    priceOverride:
      d.priceOverride.trim() !== '' && !Number.isNaN(Number.parseFloat(d.priceOverride))
        ? Number.parseFloat(d.priceOverride)
        : null,
    unit: d.unit || '1k',
  }));
}

interface LandingTiersEditorProps {
  value: TierDraft[];
  onChange: (next: TierDraft[]) => void;
  services: CatalogService[];
  servicesLoading?: boolean;
}

export function LandingTiersEditor({
  value,
  onChange,
  services,
  servicesLoading,
}: Readonly<LandingTiersEditorProps>) {
  const [error, setError] = useState<string | null>(null);

  const usedServiceIds = useMemo(() => new Set(value.map((t) => t.serviceId)), [value]);

  const updateRow = (index: number, patch: Partial<TierDraft>) => {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    validateAndSet(next);
  };

  const addRow = () => {
    if (value.length >= 8) {
      setError('Maximum 8 tiers');
      return;
    }
    const nextOrder = value.length === 0 ? 0 : Math.max(...value.map((t) => t.order)) + 1;
    const next: TierDraft[] = [
      ...value,
      {
        serviceId: '',
        order: nextOrder,
        pillKind: null,
        glowKind: null,
        titleOverride: '',
        descOverride: '',
        priceOverride: '',
        unit: '1k',
      },
    ];
    validateAndSet(next);
  };

  const removeRow = (index: number) => {
    validateAndSet(value.filter((_, i) => i !== index));
  };

  const validateAndSet = (next: TierDraft[]) => {
    const serviceIds = next.filter((t) => t.serviceId).map((t) => t.serviceId);
    const uniqueServiceIds = new Set(serviceIds);
    if (uniqueServiceIds.size !== serviceIds.length) {
      setError('Duplicate service in tiers');
    } else {
      const orders = next.map((t) => t.order);
      const uniqueOrders = new Set(orders);
      if (uniqueOrders.size !== orders.length) {
        setError('Duplicate order in tiers');
      } else {
        setError(null);
      }
    }
    onChange(next);
  };

  const serviceById = useMemo(() => {
    const m = new Map<string, CatalogService>();
    for (const svc of services) m.set(svc.id, svc);
    return m;
  }, [services]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tiers</h3>
          <p className="text-sm text-muted-foreground">
            1-8 tiers. Unique service + unique order per landing.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={value.length >= 8 || servicesLoading}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Tier
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Order</TableHead>
              <TableHead className="min-w-[220px]">Service</TableHead>
              <TableHead className="w-36">Pill</TableHead>
              <TableHead className="w-36">Glow</TableHead>
              <TableHead className="min-w-[160px]">Title override</TableHead>
              <TableHead className="min-w-[200px]">Desc override</TableHead>
              <TableHead className="w-28">Price override</TableHead>
              <TableHead className="w-20">Unit</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                  No tiers. Click &quot;Add Tier&quot; to start.
                </TableCell>
              </TableRow>
            ) : (
              value.map((row, i) => {
                const selectedService = serviceById.get(row.serviceId);
                return (
                  <TableRow key={`tier-${i}`}>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        value={row.order}
                        onChange={(e) =>
                          updateRow(i, { order: Number.parseInt(e.target.value || '0', 10) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.serviceId || undefined}
                        onValueChange={(v) => updateRow(i, { serviceId: v })}
                        disabled={servicesLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service">
                            {selectedService?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((svc) => {
                            const taken = usedServiceIds.has(svc.id) && svc.id !== row.serviceId;
                            return (
                              <SelectItem key={svc.id} value={svc.id} disabled={taken}>
                                {svc.name}
                                {taken ? ' (used)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.pillKind ?? 'NONE'}
                        onValueChange={(v) =>
                          updateRow(i, {
                            pillKind: v === 'NONE' ? null : (v as LandingTierPill),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PILL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.glowKind ?? 'NONE'}
                        onValueChange={(v) =>
                          updateRow(i, {
                            glowKind: v === 'NONE' ? null : (v as LandingTierGlow),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GLOW_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.titleOverride}
                        onChange={(e) => updateRow(i, { titleOverride: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.descOverride}
                        onChange={(e) => updateRow(i, { descOverride: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.priceOverride}
                        onChange={(e) => updateRow(i, { priceOverride: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.unit}
                        onChange={(e) => updateRow(i, { unit: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(i)}
                        aria-label="Remove tier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        <Label className="inline">Pricing</Label>: leave &quot;Price override&quot; empty to use the
        service&apos;s pricePer1000. Title/desc overrides are optional.
      </p>
    </div>
  );
}
