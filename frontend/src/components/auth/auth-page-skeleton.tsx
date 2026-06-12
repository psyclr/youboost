import { Skeleton } from '@/components/ui/skeleton';

/**
 * Card-shaped placeholder used as the Suspense fallback for auth pages
 * while client components hydrate (they read useSearchParams).
 */
export function AuthPageSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
