import { getPrisma } from '../../shared/database';
import type { DepositStatus } from '../../generated/prisma';
import type { DepositRecord } from './deposit.types';

type PrismaTransactionClient = Parameters<
  Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]
>[0];

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
  tx?: PrismaTransactionClient,
): Promise<DepositRecord | null> {
  const client = tx ?? getPrisma();
  const where: { id: string; userId?: string } = { id: depositId };
  if (userId) {
    where.userId = userId;
  }
  return client.deposit.findFirst({ where });
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

export async function findAllDeposits(filters: {
  status?: DepositStatus | undefined;
  userId?: string | undefined;
  page: number;
  limit: number;
}): Promise<{ deposits: DepositRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;

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

export async function findExpiredPendingDeposits(): Promise<DepositRecord[]> {
  const prisma = getPrisma();
  return prisma.deposit.findMany({
    where: {
      status: 'PENDING' as DepositStatus,
      expiresAt: { lt: new Date() },
    },
    orderBy: { expiresAt: 'asc' },
    take: 200,
  });
}

export async function updateDepositStripeSession(
  depositId: string,
  stripeSessionId: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.deposit.update({
    where: { id: depositId },
    data: { stripeSessionId, paymentMethod: 'STRIPE' },
  });
}

export async function updateDepositCryptomusOrder(
  depositId: string,
  data: { cryptomusOrderId: string; cryptomusCheckoutUrl: string },
): Promise<void> {
  const prisma = getPrisma();
  await prisma.deposit.update({
    where: { id: depositId },
    data: {
      cryptomusOrderId: data.cryptomusOrderId,
      cryptomusCheckoutUrl: data.cryptomusCheckoutUrl,
      paymentMethod: 'CRYPTOMUS',
    },
  });
}

export async function findDepositByCryptomusOrderId(
  cryptomusOrderId: string,
  tx?: PrismaTransactionClient,
): Promise<DepositRecord | null> {
  const client = tx ?? getPrisma();
  return client.deposit.findUnique({ where: { cryptomusOrderId } });
}

export async function updateDepositStatus(
  depositId: string,
  data: {
    status: DepositStatus;
    txHash?: string | null;
    confirmedAt?: Date | null;
    ledgerEntryId?: string | null;
  },
  tx?: PrismaTransactionClient,
): Promise<DepositRecord> {
  const client = tx ?? getPrisma();
  return client.deposit.update({
    where: { id: depositId },
    data,
  });
}
