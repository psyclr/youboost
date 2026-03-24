'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrder, useCancelOrder, useRefillOrder } from '@/hooks/use-orders';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';

function formatInterval(minutes: number | null): string {
  if (!minutes) return 'N/A';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hours = minutes / 60;
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  const days = minutes / 1440;
  return `${days} day${days > 1 ? 's' : ''}`;
}

export default function OrderDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const { data: order, isLoading } = useOrder(id);
  const cancelMutation = useCancelOrder();
  const refillMutation = useRefillOrder();
  const [showCancel, setShowCancel] = useState(false);

  const canCancel = order && (order.status === 'PENDING' || order.status === 'PROCESSING');
  const canRefill =
    order?.status === 'COMPLETED' &&
    order?.refillEligibleUntil &&
    new Date(order.refillEligibleUntil) > new Date();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Order cancelled');
      setShowCancel(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to cancel order');
      }
    }
  };

  const handleRefill = async () => {
    try {
      const result = await refillMutation.mutateAsync(id);
      toast.success('Refill order created');
      router.push(`/orders/${result.orderId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create refill');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Order not found</p>
        <Button asChild variant="link" className="mt-2">
          <Link href="/orders">Back to orders</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Order Details</h1>
          <p className="text-sm text-muted-foreground font-mono">{order.orderId}</p>
        </div>
        <div className="flex gap-2">
          {canRefill && (
            <Button variant="outline" onClick={handleRefill} disabled={refillMutation.isPending}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {refillMutation.isPending ? 'Requesting...' : 'Request Refill'}
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setShowCancel(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Information</CardTitle>
            <div className="flex items-center gap-2">
              {order.isDripFeed && <Badge variant="secondary">Drip-feed</Badge>}
              <StatusBadge status={order.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Quantity</p>
              <p className="font-medium">{order.quantity.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="font-medium">{formatCurrency(order.price)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="font-medium">{order.completed.toLocaleString()}</p>
            </div>
            {order.remains !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="font-medium">{order.remains.toLocaleString()}</p>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground">Link</p>
            <a
              href={order.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {order.link}
            </a>
          </div>

          {order.comments && (
            <div>
              <p className="text-sm text-muted-foreground">Comments</p>
              <p className="text-sm">{order.comments}</p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p>{formatDate(order.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.isDripFeed && (
        <Card>
          <CardHeader>
            <CardTitle>Drip-feed Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Runs Completed</p>
                <p className="font-medium">
                  {order.dripFeedRunsCompleted} / {order.dripFeedRuns ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interval</p>
                <p className="font-medium">{formatInterval(order.dripFeedInterval)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Run</p>
                <p className="font-medium">
                  {order.dripFeedRuns
                    ? Math.ceil(order.quantity / order.dripFeedRuns).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
            </div>
            {order.dripFeedRuns && (
              <div className="mt-4">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${(order.dripFeedRunsCompleted / order.dripFeedRuns) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(order.refillEligibleUntil || order.refillCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Refill / Warranty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {order.refillEligibleUntil && (
                <div>
                  <p className="text-sm text-muted-foreground">Eligible Until</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{formatDate(order.refillEligibleUntil)}</p>
                    {canRefill ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Expired
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Refills Used</p>
                <p className="font-medium">{order.refillCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel Order"
        description="Are you sure you want to cancel this order? Any remaining balance will be refunded."
        confirmLabel="Cancel Order"
        onConfirm={handleCancel}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
