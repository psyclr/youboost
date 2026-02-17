import { getPrisma } from '../../shared/database';
import type { DepositStatus } from '../../generated/prisma';
import type { DepositRecord } from './deposit.types';

export async function createDeposit(data: {
  userId: string;
  amount: number;
  cryptoAmount: number;
  cryptoCurrency: string;
  paymentAddress: string;
  expiresAt: Date;
}): Promise<DepositRecord> {
  const prisma = getPrisma();
  return prisma.deposit.create({
    data: {
      userId: data.userId,
      amount: data.amount,
      cryptoAmount: data.cryptoAmount,
      cryptoCurrency: data.cryptoCurrency,
      paymentAddress: data.paymentAddress,
      status: 'PENDING',
      expiresAt: data.expiresAt,
    },
  });
}

export async function findDepositById(
  depositId: string,
  userId?: string | undefined,
): Promise<DepositRecord | null> {
  const prisma = getPrisma();
  const where: { id: string; userId?: string } = { id: depositId };
  if (userId) {
    where.userId = userId;
  }
  return prisma.deposit.findFirst({ where });
}

export async function findDepositsByUserId(
  userId: string,
  filters: { status?: DepositStatus | undefined; page: number; limit: number },
): Promise<{ deposits: DepositRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: { userId: string; status?: DepositStatus } = { userId };
  if (filters.status) {
    where.status = filters.status;
  }

  const [deposits, total] = await Promise.all([
    prisma.deposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.deposit.count({ where }),
  ]);

  return { deposits, total };
}

export async function updateDepositStatus(
  depositId: string,
  data: {
    status: DepositStatus;
    txHash?: string | null;
    confirmedAt?: Date | null;
    ledgerEntryId?: string | null;
  },
): Promise<DepositRecord> {
  const prisma = getPrisma();
  return prisma.deposit.update({
    where: { id: depositId },
    data,
  });
}
