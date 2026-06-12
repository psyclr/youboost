import { Badge } from '@/components/ui/badge';
import { ticketStatusConfig, ticketPriorityConfig } from '@/lib/constants/tickets';

export function TicketStatusBadge({ status }: Readonly<{ status: string }>) {
  const config = ticketStatusConfig[status] ?? { className: '', label: status };
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function TicketPriorityBadge({ priority }: Readonly<{ priority: string }>) {
  const config = ticketPriorityConfig[priority] ?? { className: '' };
  return (
    <Badge variant="secondary" className={config.className}>
      {priority}
    </Badge>
  );
}
