'use client';

import { useEffect, useRef, useState } from 'react';
import { useCatalog } from '@/hooks/use-catalog';
import { usePagination } from '@/hooks/use-pagination';
import { useUrlParam } from '@/hooks/use-url-param';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { QueryError } from '@/components/shared/query-error';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Search, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ServiceType } from '@/lib/api/types';
import { PLATFORMS } from '@/lib/constants/platforms';
import Link from 'next/link';

const platforms: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...PLATFORMS.map((p) => ({ value: p.id, label: p.label })),
];

const serviceTypeLabels: Record<ServiceType, string> = {
  VIEWS: 'Views',
  SUBSCRIBERS: 'Subscribers',
  LIKES: 'Likes',
  COMMENTS: 'Comments',
  SHARES: 'Shares',
};

export default function CatalogPage() {
  const [platform, setPlatform] = useUrlParam('platform', 'ALL');
  // Local mirror so the input updates instantly; the debounced value drives the query.
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const { page, setPage } = usePagination();

  const { data, isLoading, isError, refetch } = useCatalog({
    page,
    limit: 12,
    platform: platform === 'ALL' ? undefined : platform,
    search: debouncedSearch || undefined,
  });

  // A new search term can shrink the result set; reset to page 1 so we don't
  // land on a now-out-of-range page. Only fires when the debounced term changes.
  const prevSearchRef = useRef(debouncedSearch);
  useEffect(() => {
    if (prevSearchRef.current !== debouncedSearch) {
      prevSearchRef.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch, setPage]);

  const services = data?.services ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Service Catalog</h1>
        <p className="text-muted-foreground">Browse and order social media services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={platform} onValueChange={setPlatform}>
        <TabsList>
          {platforms.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Card key={`skeleton-${n}`} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && isError && <QueryError onRetry={() => void refetch()} />}
      {!isLoading && !isError && services.length === 0 && (
        <EmptyState
          title="No services found"
          description="Try adjusting your filters or search query"
        />
      )}
      {!isLoading && !isError && services.length > 0 && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <PlatformBadge platform={service.platform} />
                    <Badge variant="outline">{serviceTypeLabels[service.type]}</Badge>
                  </div>
                  <CardTitle className="text-base">{service.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {service.description && (
                    <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                  )}
                  {service.refillDays && (
                    <Badge variant="outline" className="mb-2 text-green-600 border-green-600">
                      {service.refillDays}-day refill guarantee
                    </Badge>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {formatCurrency(service.pricePer1000)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 1000</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Min: {service.minQuantity.toLocaleString()} — Max:{' '}
                    {service.maxQuantity.toLocaleString()}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/orders/new?serviceId=${service.id}`}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Order
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= data.pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
