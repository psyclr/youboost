'use client';

import { DataTable, type Column } from '@/components/shared/data-table';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AdminServiceResponse } from '@/lib/api/types';

interface ServiceTableProps {
  services: AdminServiceResponse[];
  isLoading: boolean;
  onEdit: (service: AdminServiceResponse) => void;
  onToggleStatus: (service: AdminServiceResponse) => void;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

function buildColumns(
  onEdit: (service: AdminServiceResponse) => void,
  onToggleStatus: (service: AdminServiceResponse) => void,
): Column<AdminServiceResponse>[] {
  return [
    {
      header: 'Name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && (
            <div className="text-sm text-muted-foreground line-clamp-1">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Platform',
      cell: (row) => <PlatformBadge platform={row.platform} />,
    },
    {
      header: 'Type',
      cell: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
    {
      header: 'Price',
      cell: (row) => (
        <span className="font-mono text-sm">{formatCurrency(row.pricePer1000)}/1K</span>
      ),
    },
    {
      header: 'Quantity',
      cell: (row) => (
        <div className="text-sm">
          <div>
            {row.minQuantity.toLocaleString()} - {row.maxQuantity.toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Provider',
      cell: (row) => (
        <div className="text-sm">
          {row.providerName ? (
            <>
              <div>{row.providerName}</div>
              <div className="text-muted-foreground">#{row.externalServiceId}</div>
            </>
          ) : (
            <span className="text-muted-foreground">Not linked</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge
          variant={row.isActive ? 'default' : 'secondary'}
          className={row.isActive ? 'bg-green-600' : ''}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => onEdit(row)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onToggleStatus(row)}>
            {row.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      ),
    },
  ];
}

export function ServiceTable({
  services,
  isLoading,
  onEdit,
  onToggleStatus,
  pagination,
}: Readonly<ServiceTableProps>) {
  const columns = buildColumns(onEdit, onToggleStatus);

  return (
    <DataTable columns={columns} data={services} isLoading={isLoading} pagination={pagination} />
  );
}
