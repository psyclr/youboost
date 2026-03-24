'use client';

import { useQuery } from '@tanstack/react-query';
import { getReferralStats } from '@/lib/api/referrals';
import type { ReferralBonusSummary } from '@/lib/api/referrals';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Gift, Users, DollarSign, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

const columns: Column<ReferralBonusSummary>[] = [
  { header: 'Username', accessorKey: 'referredUsername' },
  {
    header: 'Amount',
    cell: (row) => formatCurrency(row.amount),
  },
  {
    header: 'Status',
    cell: (row) => (
      <Badge variant={row.status === 'CREDITED' ? 'default' : 'secondary'}>{row.status}</Badge>
    ),
  },
  {
    header: 'Date',
    cell: (row) => formatDate(row.createdAt),
  },
];

export default function ReferralPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['referral-stats'],
    queryFn: getReferralStats,
  });

  const referralLink =
    typeof globalThis !== 'undefined' && data?.referralCode
      ? `${globalThis.location.origin}/register?ref=${data.referralCode}`
      : '';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground">Invite friends and earn rewards when they join</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Code</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (data?.referralCode ?? '-')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referred</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : (data?.totalReferred ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(data?.totalEarned ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.referralCode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share Your Referral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Referral Code</Label>
              <div className="flex gap-2">
                <Input value={data.referralCode} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(data.referralCode, 'Referral code')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Referral Link</Label>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(referralLink, 'Referral link')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Referral History</h2>
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {!isLoading && (!data?.bonuses || data.bonuses.length === 0) && (
          <EmptyState
            title="No referrals yet"
            description="Share your referral code with friends to start earning rewards"
          />
        )}
        {!isLoading && data?.bonuses && data.bonuses.length > 0 && (
          <DataTable columns={columns} data={data.bonuses} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}
