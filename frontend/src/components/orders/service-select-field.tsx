import type { Control, FieldValues, Path } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlatformBadge } from '@/components/shared/platform-badge';
import type { CatalogService } from '@/lib/api/types';

interface ServiceSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  services: CatalogService[] | undefined;
  /** Optional side-effect fired after the form field value changes. */
  onServiceChange?: (serviceId: string) => void;
}

/**
 * Shared service picker rendered identically by the single and bulk order forms.
 * Iterates the catalog services, showing each name alongside its PlatformBadge.
 */
export function ServiceSelectField<T extends FieldValues>({
  control,
  name,
  services,
  onServiceChange,
}: Readonly<ServiceSelectFieldProps<T>>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Service</FormLabel>
          <Select
            value={field.value}
            onValueChange={(val) => {
              field.onChange(val);
              onServiceChange?.(val);
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {services?.map((s) => (
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
  );
}
