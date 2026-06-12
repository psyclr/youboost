import { Badge } from '@/components/ui/badge';
import type { OrderStatus, DepositStatus } from '@/lib/api/types';
import { STATUS_BADGE_CLASSNAMES } from '@/lib/constants/statuses';

type StatusType = OrderStatus | DepositStatus;

export function StatusBadge({ status }: Readonly<{ status: StatusType }>) {
  const className = STATUS_BADGE_CLASSNAMES[status] ?? '';
  return (
    <Badge variant="secondary" className={className}>
      {status}
    </Badge>
  );
}
