import { z } from 'zod/v4';

export const depositIdSchema = z.object({
  depositId: z.uuid(),
});

export const depositsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'FAILED']).optional(),
});

export type DepositIdParam = z.infer<typeof depositIdSchema>;
export type DepositsQuery = z.infer<typeof depositsQuerySchema>;

export interface DepositRecord {
  id: string;
  userId: string;
  amount: { toNumber(): number };
  cryptoAmount: { toNumber(): number };
  cryptoCurrency: string;
  paymentAddress: string;
  status: string;
  txHash: string | null;
  expiresAt: Date;
  confirmedAt: Date | null;
  ledgerEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositDetailResponse {
  id: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentAddress: string;
  status: string;
  txHash: string | null;
  expiresAt: Date;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface PaginatedDeposits {
  deposits: DepositDetailResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
