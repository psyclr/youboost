import type { OrderStatus } from '@/lib/api/types';
import { STATUS_BADGE_CLASSNAMES } from '@/lib/constants/statuses';

export interface CustomerStatus {
  label: string;
  className: string;
}

/**
 * Collapse the internal order status into what the customer is allowed to see.
 *
 * The customer never sees the fulfilment machinery — awaiting payment, partial,
 * failed, or the fact that we retry across panels all read as "In progress".
 * Only terminal, customer-meaningful outcomes are shown verbatim: Completed,
 * Cancelled (their own cancel), and Refunded (money positively returned).
 *
 * Admin views use the raw status (the shared StatusBadge stays raw) — this
 * mapping is applied only in customer-facing order pages.
 */
export function customerOrderStatus(status: OrderStatus | string): CustomerStatus {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', className: STATUS_BADGE_CLASSNAMES.COMPLETED ?? '' };
    case 'CANCELLED':
      return { label: 'Cancelled', className: STATUS_BADGE_CLASSNAMES.CANCELLED ?? '' };
    case 'REFUNDED':
      return { label: 'Refunded', className: STATUS_BADGE_CLASSNAMES.REFUNDED ?? '' };
    default:
      return { label: 'In progress', className: STATUS_BADGE_CLASSNAMES.PROCESSING ?? '' };
  }
}
