'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminUsers } from '@/lib/api/admin';
import { usePagination } from '@/hooks/use-pagination';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { AdminUserResponse, UserRole, UserStatus } from '@/lib/api/types';
import { useRouter } from 'next/navigation';

const columns: Column<AdminUserResponse>[] = [
  { header: 'Username', accessorKey: 'username' },
  { header: 'Email', accessorKey: 'email' },
  {
    header: 'Role',
    cell: (row) => <Badge variant="outline">{row.role}</Badge>,
  },
  {
    header: 'Status',
    cell: (row) => (
      <Badge variant={row.status === 'ACTIVE' ? 'default' : 'destructive'}>{row.status}</Badge>
    ),
  },
  {
    header: 'Joined',
    cell: (row) => formatDate(row.createdAt),
  },
];

const roles = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'USER', label: 'User' },
  { value: 'RESELLER', label: 'Reseller' },
  { value: 'ADMIN', label: 'Admin' },
];

const statuses = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
];

export default function AdminUsersPage() {
  const [role, setRole] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const { page, setPage } = usePagination();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, role, status }],
    queryFn: () =>
      getAdminUsers({
        page,
        limit: 20,
        role: role === 'ALL' ? undefined : (role as UserRole),
        status: status === 'ALL' ? undefined : (status as UserStatus),
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage platform users</p>
      </div>

      <div className="flex gap-4">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.users ?? []}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/admin/users/${row.userId}`)}
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
