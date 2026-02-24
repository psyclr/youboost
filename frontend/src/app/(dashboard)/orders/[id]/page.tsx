'use client';

import { use, useState } from 'react';
import { useOrder, useCancelOrder } from '@/hooks/use-orders';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useOrder(id);
  const cancelMutation = useCancelOrder();
  const [showCancel, setShowCancel] = useState(false);

  const canCancel = order && (order.status === 'PENDING' || order.status === 'PROCESSING');

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
        {canCancel && (
          <Button variant="destructive" onClick={() => setShowCancel(true)}>
            <XCircle className="h-4 w-4 mr-2" />
            Cancel Order
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Information</CardTitle>
            <StatusBadge status={order.status} />
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
