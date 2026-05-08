import type { PrismaClient } from '../../../generated/prisma';
import { createLedgerRepository } from '../ledger.repository';

const mockLedger = {
  id: 'ledger-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  type: 'DEPOSIT',
  amount: { toNumber: (): number => 100 },
  balanceBefore: { toNumber: (): number => 0 },
  balanceAfter: { toNumber: (): number => 100 },
  referenceType: null,
  referenceId: null,
  description: 'Test deposit',
  metadata: null,
  createdAt: new Date(),
};

function makePrisma(): {
  prisma: PrismaClient;
  create: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
} {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const prisma = {
    ledger: { create, findFirst, findMany, count },
  } as unknown as PrismaClient;
  return { prisma, create, findFirst, findMany, count };
}

describe('Ledger Repository', () => {
  describe('createLedgerEntry', () => {
    const data = {
      userId: 'user-1',
      walletId: 'wallet-1',
      type: 'DEPOSIT' as const,
      amount: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      description: 'Test deposit',
    };

    it('should create a ledger entry', async () => {
      const { prisma, create } = makePrisma();
      create.mockResolvedValue(mockLedger);
      const repo = createLedgerRepository(prisma);

      const result = await repo.createLedgerEntry(data);

      expect(result).toEqual(mockLedger);
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          walletId: 'wallet-1',
          type: 'DEPOSIT',
          amount: 100,
          description: 'Test deposit',
        }),
      });
    });

    it('should use transaction client if provided', async () => {
      const { prisma } = makePrisma();
      const txCreate = jest.fn().mockResolvedValue(mockLedger);
      const txClient = { ledger: { create: txCreate } };
      const repo = createLedgerRepository(prisma);

      await repo.createLedgerEntry(data, txClient as never);

      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', type: 'DEPOSIT' }),
      });
    });
  });

  describe('findLedgerById', () => {
    it('should find ledger by id scoped to userId', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(mockLedger);
      const repo = createLedgerRepository(prisma);

      const result = await repo.findLedgerById('ledger-1', 'user-1');

      expect(result).toEqual(mockLedger);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'ledger-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(null);
      const repo = createLedgerRepository(prisma);

      const result = await repo.findLedgerById('ledger-2', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findLedgerEntries', () => {
    it('should return paginated entries', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([mockLedger]);
      count.mockResolvedValue(1);
      const repo = createLedgerRepository(prisma);

      const result = await repo.findLedgerEntries('user-1', { page: 1, limit: 20 });

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply type filter', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createLedgerRepository(prisma);

      await repo.findLedgerEntries('user-1', { page: 1, limit: 10, type: 'HOLD' });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', type: 'HOLD' },
        }),
      );
    });

    it('should calculate correct skip for page 2', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(25);
      const repo = createLedgerRepository(prisma);

      await repo.findLedgerEntries('user-1', { page: 2, limit: 10 });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });
  });
});
