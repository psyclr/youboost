'use client';

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
import type { Platform, ServiceType } from '@/lib/api/types';

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
  onBrowseProviderServices: () => void;
  providers?: Array<{ providerId: string; name: string }>;
  isSubmitting?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function ServiceForm({
  form,
  onUpdateField,
  onBrowseProviderServices,
  providers = [],
  isSubmitting = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Readonly<ServiceFormProps>) {
  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <Label>External Service ID</Label>
        <div className="flex gap-2">
          <Input
            value={form.externalServiceId}
            onChange={(e) => onUpdateField('externalServiceId', e.target.value)}
            placeholder="e.g. 1, 2, 3..."
          />
          <Button
            type="button"
            variant="outline"
            onClick={onBrowseProviderServices}
            disabled={!form.providerId}
          >
            Browse
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The service ID from the provider&apos;s panel. Use Browse to fetch available services, or
          enter manually.
        </p>
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
