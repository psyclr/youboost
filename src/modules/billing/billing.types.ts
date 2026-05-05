import { z } from 'zod/v4';
import type { LedgerType } from '../../generated/prisma';

export const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z
    .enum(['DEPOSIT', 'WITHDRAW', 'HOLD', 'RELEASE', 'REFUND', 'FEE', 'ADMIN_ADJUSTMENT'])
    .optional(),
});

export const transactionIdSchema = z.object({
  transactionId: z.uuid(),
});

export type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;
export type TransactionIdParam = z.infer<typeof transactionIdSchema>;

export interface BalanceResponse {
  userId: string;
  balance: number;
  frozen: number;
  available: number;
  currency: string;
}

export interface TransactionSummary {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: Date;
}

export interface TransactionDetailed extends TransactionSummary {
  balanceBefore: number;
  balanceAfter: number;
  metadata: unknown;
  referenceType: string | null;
  referenceId: string | null;
}

export interface PaginatedTransactions {
  transactions: TransactionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WalletRecord {
  id: string;
  userId: string;
  balance: { toNumber(): number };
  currency: string;
  holdAmount: { toNumber(): number };
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerRecord {
  id: string;
  userId: string;
  walletId: string;
  type: string;
  amount: { toNumber(): number };
  balanceBefore: { toNumber(): number };
  balanceAfter: { toNumber(): number };
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface CreateLedgerData {
  userId: string;
  walletId: string;
  type: LedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}
