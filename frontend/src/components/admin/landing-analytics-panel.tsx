'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { LandingAnalyticsResponse } from '@/lib/api/types';

interface LandingAnalyticsPanelProps {
  analytics?: LandingAnalyticsResponse;
  isLoading?: boolean;
}

interface Card {
  label: string;
  value: string;
  emphasis?: boolean;
}

function buildCards(a: LandingAnalyticsResponse): Card[] {
  return [
    { label: 'Views', value: a.views.toLocaleString() },
    { label: 'Calculator Uses', value: a.calculatorUses.toLocaleString() },
    { label: 'Checkouts Started', value: a.checkoutsStarted.toLocaleString() },
    { label: 'Checkouts Completed', value: a.checkoutsCompleted.toLocaleString() },
    { label: 'Revenue', value: formatCurrency(a.revenueUsd), emphasis: true },
  ];
}

export function LandingAnalyticsPanel({
  analytics,
  isLoading,
}: Readonly<LandingAnalyticsPanelProps>) {
  if (isLoading || !analytics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = buildCards(analytics);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={card.emphasis ? 'border-brand-red/30 bg-brand-red/5' : undefined}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={card.emphasis ? 'text-2xl font-bold text-brand-red' : 'text-2xl font-bold'}
            >
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
