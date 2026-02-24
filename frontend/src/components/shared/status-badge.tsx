import { Badge } from '@/components/ui/badge';
import type { OrderStatus, DepositStatus } from '@/lib/api/types';

type StatusType = OrderStatus | DepositStatus;

const statusConfig: Record<string, { className: string }> = {
  PENDING: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  PROCESSING: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  COMPLETED: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  CONFIRMED: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  PARTIAL: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  CANCELLED: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  FAILED: { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  REFUNDED: { className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' },
  EXPIRED: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};

export function StatusBadge({ status }: { status: StatusType }) {
  const config = statusConfig[status] ?? { className: '' };
  return (
    <Badge variant="secondary" className={config.className}>
      {status}
    </Badge>
  );
}
