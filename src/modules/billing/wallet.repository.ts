import { getPrisma } from '../../shared/database';
import type { WalletRecord } from './billing.types';

type PrismaTransactionClient = Parameters<
  Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]
>[0];

export type { PrismaTransactionClient };

interface UpdateBalanceOptions {
  walletId: string;
  newBalance: number;
  newHold: number;
  tx?: PrismaTransactionClient;
}

export async function getOrCreateWallet(userId: string, currency = 'USD'): Promise<WalletRecord> {
  const prisma = getPrisma();
  try {
    return await prisma.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency },
      update: {},
    });
  } catch {
    const existing = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
    if (existing) return existing;
    throw new Error('Failed to create or find wallet');
  }
}

export async function findWalletByUserId(
  userId: string,
  currency = 'USD',
): Promise<WalletRecord | null> {
  const prisma = getPrisma();
  return prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
}

export async function updateBalance(opts: UpdateBalanceOptions): Promise<WalletRecord> {
  const client = opts.tx ?? getPrisma();
  return client.wallet.update({
    where: { id: opts.walletId },
    data: { balance: opts.newBalance, holdAmount: opts.newHold },
  });
}
