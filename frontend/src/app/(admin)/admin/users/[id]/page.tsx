'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUser, updateAdminUser, adjustBalance } from '@/lib/api/admin';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { UserRole, UserStatus } from '@/lib/api/types';

export default function AdminUserDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => getAdminUser(id),
  });

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: { role?: string; status?: string }) => updateAdminUser(id, data),
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update user');
    },
  });

  const balanceMutation = useMutation({
    mutationFn: (data: { amount: number; reason: string }) => adjustBalance(id, data),
    onSuccess: () => {
      toast.success('Balance adjusted');
      setAdjustAmount('');
      setAdjustReason('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to adjust balance');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <p className="text-muted-foreground text-center py-12">User not found</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Select
                  value={user.role}
                  onValueChange={(v) => updateMutation.mutate({ role: v as UserRole })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="RESELLER">Reseller</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Select
                  value={user.status}
                  onValueChange={(v) => updateMutation.mutate({ status: v as UserStatus })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="BANNED">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Email Verified</p>
                <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                  {user.emailVerified ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p>{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>Current balance information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.wallet ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold">{formatCurrency(user.wallet.balance)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Frozen</p>
                  <p className="text-lg font-bold">{formatCurrency(user.wallet.frozen)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-lg font-bold">{formatCurrency(user.wallet.available)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No wallet found</p>
            )}

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Adjust Balance</p>
              <div className="space-y-2">
                <Label>Amount (positive to add, negative to deduct)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 50 or -25"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Reason for adjustment"
                />
              </div>
              <Button
                onClick={() =>
                  balanceMutation.mutate({
                    amount: Number.parseFloat(adjustAmount),
                    reason: adjustReason,
                  })
                }
                disabled={!adjustAmount || !adjustReason || balanceMutation.isPending}
                className="w-full"
              >
                {balanceMutation.isPending ? 'Adjusting...' : 'Adjust Balance'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
