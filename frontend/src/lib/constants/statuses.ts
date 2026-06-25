import type { OrderStatus, DepositStatus, LedgerType } from '@/lib/api/types';

// ============================================
// Order statuses
// ============================================

interface StatusOption<T extends string> {
  value: T;
  label: string;
}

// Single source of truth for the real OrderStatus union (value + humanized label).
// Order matches the historical filter/badge ordering.
export const ORDER_STATUSES: StatusOption<OrderStatus>[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
];

// Bulk-action list (force-status dialog) — the raw OrderStatus union, no sentinels.
export const ORDER_BULK_STATUSES: OrderStatus[] = ORDER_STATUSES.map((s) => s.value);

// 'STUCK' is NOT part of the OrderStatus union — it is an admin-only virtual filter
// value (PROCESSING orders older than 24h, filtered client-side).
type OrderFilterValue = 'ALL' | OrderStatus | 'STUCK';

// Admin orders filter: leading ALL sentinel, then the standard statuses with STUCK
// inserted right after PROCESSING (preserving the historical option order).
export const ORDER_ADMIN_FILTER_STATUSES: StatusOption<OrderFilterValue>[] = [
  { value: 'ALL', label: 'All Statuses' },
  ...ORDER_STATUSES.flatMap((s): StatusOption<OrderFilterValue>[] =>
    s.value === 'PROCESSING' ? [s, { value: 'STUCK', label: 'Stuck (>24h)' }] : [s],
  ),
];

// ============================================
// Deposit statuses
// ============================================

export const DEPOSIT_STATUSES: StatusOption<DepositStatus>[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'FAILED', label: 'Failed' },
];

// Admin deposits filter: leading ALL sentinel.
export const DEPOSIT_ADMIN_FILTER_STATUSES: StatusOption<'ALL' | DepositStatus>[] = [
  { value: 'ALL', label: 'All Statuses' },
  ...DEPOSIT_STATUSES,
];

// ============================================
// Status badge colors (StatusBadge — renders the raw status text)
// ============================================

// Single source for the per-status badge classes used by StatusBadge.
// Keyed by the raw OrderStatus / DepositStatus value.
export const STATUS_BADGE_CLASSNAMES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PARTIAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  REFUNDED: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

// ============================================
// Billing — ledger transaction badge variants
// ============================================

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// Single source for the colored badge variant per ledger transaction type.
// Used by both the billing overview and the full transaction history.
export function txBadgeVariant(type: LedgerType): BadgeVariant {
  switch (type) {
    case 'DEPOSIT':
    case 'REFUND':
      return 'default';
    case 'HOLD':
    case 'WITHDRAW':
    case 'FEE':
      return 'destructive';
    case 'RELEASE':
      return 'secondary';
    default:
      return 'outline';
  }
}

// Ledger transaction type filter options (full history page).
export const LEDGER_TYPE_FILTER_OPTIONS: StatusOption<'ALL' | LedgerType>[] = [
  { value: 'ALL', label: 'All Types' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'WITHDRAW', label: 'Withdraw' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'RELEASE', label: 'Release' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'FEE', label: 'Fee' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Admin Adjustment' },
];
