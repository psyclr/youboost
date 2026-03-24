'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  getRowId?: (row: T, index: number) => string;
}

function getColumnKey<T>(col: Column<T>, index: number): string {
  return col.header || `col-${index}`;
}

function defaultGetRowId<T>(row: T, index: number): string {
  const record = row as Record<string, unknown>;
  if (record && typeof record === 'object' && 'id' in record) {
    return String(record.id);
  }
  return String(index);
}

function getCellContent<T>(col: Column<T>, row: T): React.ReactNode {
  if (col.cell) {
    return col.cell(row);
  }
  if (col.accessorKey) {
    const value = (row as Record<string, unknown>)[col.accessorKey as string];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return typeof value === 'string' ? value : `${value as string | number | boolean}`;
  }
  return null;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  pagination,
  onRowClick,
  emptyMessage = 'No data found',
  getRowId,
}: Readonly<DataTableProps<T>>) {
  const resolveRowId = getRowId ?? defaultGetRowId;
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={getColumnKey(col, i)} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((n) => (
              <TableRow key={`skeleton-${n}`}>
                {columns.map((col, j) => (
                  <TableCell key={getColumnKey(col, j)}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={getColumnKey(col, i)} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow
                  key={resolveRowId(row, i)}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
                >
                  {columns.map((col, j) => (
                    <TableCell key={getColumnKey(col, j)} className={col.className}>
                      {getCellContent(col, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
