import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface QueryErrorProps {
  onRetry?: () => void;
  message?: string;
}

export function QueryError({
  onRetry,
  message = "Couldn't load data.",
}: Readonly<QueryErrorProps>) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
