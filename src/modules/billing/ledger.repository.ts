import { getPrisma } from '../../shared/database';
import type { Prisma, PrismaClient, LedgerType } from '../../generated/prisma';
import type { LedgerRecord, CreateLedgerData } from './billing.types';

type PrismaTransactionClient = Prisma.TransactionClient;

export interface LedgerRepository {
  createLedgerEntry(data: CreateLedgerData, tx?: PrismaTransactionClient): Promise<LedgerRecord>;
  findLedgerById(id: string, userId: string): Promise<LedgerRecord | null>;
  findLedgerEntries(
    userId: string,
    filters: { type?: LedgerType | undefined; page: number; limit: number },
  ): Promise<{ entries: LedgerRecord[]; total: number }>;
}

export function createLedgerRepository(prisma: PrismaClient): LedgerRepository {
  async function createLedgerEntry(
    data: CreateLedgerData,
    tx?: PrismaTransactionClient,
  ): Promise<LedgerRecord> {
    const client = tx ?? prisma;
    const createInput: Prisma.LedgerUncheckedCreateInput = {
      userId: data.userId,
      walletId: data.walletId,
      type: data.type,
      amount: data.amount,
      balanceBefore: data.balanceBefore,
      balanceAfter: data.balanceAfter,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      description: data.description ?? null,
    };
    if (data.metadata != null) {
      createInput.metadata = data.metadata as Prisma.InputJsonValue;
    }
    return client.ledger.create({ data: createInput });
  }

  async function findLedgerById(id: string, userId: string): Promise<LedgerRecord | null> {
    return prisma.ledger.findFirst({
      where: { id, userId },
    });
  }

  async function findLedgerEntries(
    userId: string,
    filters: { type?: LedgerType | undefined; page: number; limit: number },
  ): Promise<{ entries: LedgerRecord[]; total: number }> {
    const where: { userId: string; type?: LedgerType } = { userId };
    if (filters.type) {
      where.type = filters.type;
    }

    const [entries, total] = await Promise.all([
      prisma.ledger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.ledger.count({ where }),
    ]);

    return { entries, total };
  }

  return { createLedgerEntry, findLedgerById, findLedgerEntries };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createLedgerEntry(
  data: CreateLedgerData,
  tx?: PrismaTransactionClient,
): Promise<LedgerRecord> {
  return createLedgerRepository(getPrisma()).createLedgerEntry(data, tx);
}

export async function findLedgerById(id: string, userId: string): Promise<LedgerRecord | null> {
  return createLedgerRepository(getPrisma()).findLedgerById(id, userId);
}

export async function findLedgerEntries(
  userId: string,
  filters: { type?: LedgerType | undefined; page: number; limit: number },
): Promise<{ entries: LedgerRecord[]; total: number }> {
  return createLedgerRepository(getPrisma()).findLedgerEntries(userId, filters);
}
