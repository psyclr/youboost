import type { Prisma, PrismaClient } from '../../generated/prisma';
import type { WalletRecord } from './billing.types';

type PrismaTransactionClient = Prisma.TransactionClient;

export type { PrismaTransactionClient };

interface UpdateBalanceOptions {
  walletId: string;
  newBalance: number;
  newHold: number;
  tx?: PrismaTransactionClient;
}

export interface WalletRepository {
  getOrCreateWallet(
    userId: string,
    currency?: string,
    tx?: PrismaTransactionClient,
  ): Promise<WalletRecord>;
  findWalletByUserId(userId: string, currency?: string): Promise<WalletRecord | null>;
  updateBalance(opts: UpdateBalanceOptions): Promise<WalletRecord>;
}

export function createWalletRepository(prisma: PrismaClient): WalletRepository {
  async function getOrCreateWallet(
    userId: string,
    currency = 'USD',
    tx?: PrismaTransactionClient,
  ): Promise<WalletRecord> {
    const client = tx ?? prisma;
    try {
      return await client.wallet.upsert({
        where: { userId_currency: { userId, currency } },
        create: { userId, currency },
        update: {},
      });
    } catch {
      const existing = await client.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });
      if (existing) return existing;
      throw new Error('Failed to create or find wallet');
    }
  }

  async function findWalletByUserId(
    userId: string,
    currency = 'USD',
  ): Promise<WalletRecord | null> {
    return prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
  }

  async function updateBalance(opts: UpdateBalanceOptions): Promise<WalletRecord> {
    const client = opts.tx ?? prisma;
    return client.wallet.update({
      where: { id: opts.walletId },
      data: { balance: opts.newBalance, holdAmount: opts.newHold },
    });
  }

  return { getOrCreateWallet, findWalletByUserId, updateBalance };
}
