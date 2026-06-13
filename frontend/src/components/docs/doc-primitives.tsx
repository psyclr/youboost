// Presentational primitives for the admin documentation page.
// Pure layout wrappers — no client state, safe in a Server Component.

import { Badge } from '@/components/ui/badge';

export function CodeBlock({ children }: Readonly<{ children: string }>): React.ReactElement {
  return (
    <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export function Section({
  title,
  icon: Icon,
  children,
}: Readonly<{
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function SubSection({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Callout({
  type = 'info',
  children,
}: Readonly<{
  type?: 'info' | 'warning' | 'success';
  children: React.ReactNode;
}>): React.ReactElement {
  const styles = {
    info: 'border-primary/30 bg-primary/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    success: 'border-green-500/30 bg-green-500/5',
  };
  return <div className={`border rounded-lg p-4 text-sm ${styles[type]}`}>{children}</div>;
}

export function DocStatusBadge({ status }: Readonly<{ status: string }>): React.ReactElement {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    COMPLETED: 'default',
    PROCESSING: 'secondary',
    PENDING: 'outline',
    FAILED: 'destructive',
    PARTIAL: 'secondary',
    CANCELLED: 'destructive',
    REFUNDED: 'outline',
    ACTIVE: 'default',
    SUSPENDED: 'secondary',
    BANNED: 'destructive',
  };
  return <Badge variant={variants[status] ?? 'outline'}>{status}</Badge>;
}

export function FlowStep({
  step,
  title,
  description,
}: Readonly<{
  step: number;
  title: string;
  description: string;
}>): React.ReactElement {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
