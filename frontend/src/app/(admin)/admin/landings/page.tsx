'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, ExternalLink, Eye, Pencil, Plus, XCircle } from 'lucide-react';
import {
  archiveAdminLanding,
  getAdminLandings,
  publishAdminLanding,
  unpublishAdminLanding,
} from '@/lib/api/admin-landings';
import { ApiError } from '@/lib/api/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { AdminLandingListItem, LandingStatus } from '@/lib/api/types';

const STATUS_FILTERS: { value: LandingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function statusBadgeClass(status: LandingStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-muted text-muted-foreground hover:bg-muted';
    case 'PUBLISHED':
      return 'bg-accent text-accent-foreground hover:bg-accent';
    case 'ARCHIVED':
      return 'bg-brand-graphite text-white hover:bg-brand-graphite';
  }
}

export default function AdminLandingsPage() {
  const [status, setStatus] = useState<'ALL' | LandingStatus>('ALL');
  const [limit, setLimit] = useState<number>(20);
  const { page, setPage } = usePagination();
  const queryClient = useQueryClient();

  const statusParam = status === 'ALL' ? undefined : status;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'landings', { page, limit, status }],
    queryFn: () => getAdminLandings({ page, limit, status: statusParam }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'landings'] });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishAdminLanding(id),
    onSuccess: () => {
      toast.success('Landing published');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to publish');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => unpublishAdminLanding(id),
    onSuccess: () => {
      toast.success('Landing unpublished');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to unpublish');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveAdminLanding(id),
    onSuccess: () => {
      toast.success('Landing archived');
      invalidate();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to archive');
    },
  });

  const columns: Column<AdminLandingListItem>[] = [
    {
      header: 'Slug',
      cell: (row) => (
        <Link
          href={`/admin/landings/${row.id}`}
          className="font-mono text-sm font-medium hover:underline"
        >
          {row.slug}
        </Link>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={cn('font-medium', statusBadgeClass(row.status))}>{row.status}</Badge>
      ),
    },
    {
      header: 'Tiers',
      cell: (row) => <span className="text-sm">{row.tierCount}</span>,
    },
    {
      header: 'SEO Title',
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{row.seoTitle}</span>
      ),
    },
    {
      header: 'Updated',
      cell: (row) => <span className="text-sm">{formatDate(row.updatedAt)}</span>,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="View landing">
            <Link href={`/lp/${row.slug}`} target="_blank">
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Edit landing">
            <Link href={`/admin/landings/${row.id}`}>
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          {row.status === 'PUBLISHED' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => unpublishMutation.mutate(row.id)}
              disabled={unpublishMutation.isPending}
              aria-label="Unpublish landing"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => publishMutation.mutate(row.id)}
              disabled={publishMutation.isPending || row.status === 'ARCHIVED'}
              aria-label="Publish landing"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm(`Archive landing "${row.slug}"?`)) {
                archiveMutation.mutate(row.id);
              }
            }}
            disabled={archiveMutation.isPending || row.status === 'ARCHIVED'}
            className="text-destructive hover:text-destructive"
            aria-label="Archive landing"
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Landings</h1>
          <p className="text-muted-foreground">Marketing pages backed by landing tiers</p>
        </div>
        <Button asChild>
          <Link href="/admin/landings/new">
            <Plus className="h-4 w-4 mr-2" />
            New Landing
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as 'ALL' | LandingStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Page Size</label>
          <Select
            value={String(limit)}
            onValueChange={(v) => {
              setLimit(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.pagination && (
          <div className="ml-auto text-sm text-muted-foreground self-center">
            Total: {data.pagination.total}
            {' · '}
            <Link
              href="/lp"
              target="_blank"
              className="inline-flex items-center gap-1 hover:underline"
            >
              Public listing <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.landings ?? []}
        isLoading={isLoading}
        emptyMessage="No landings yet"
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
  );
}
