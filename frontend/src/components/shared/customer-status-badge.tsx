import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/api/types';
import { customerOrderStatus } from '@/lib/orders/customer-status';

/**
 * Order status as shown to the CUSTOMER — internal states are collapsed (see
 * customerOrderStatus). Admin surfaces use the raw {@link StatusBadge} instead.
 */
export function CustomerStatusBadge({ status }: Readonly<{ status: OrderStatus }>) {
  const { label, className } = customerOrderStatus(status);
  return (
    <Badge variant="secondary" className={className}>
      {label}
    </Badge>
  );
}
