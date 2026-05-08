import type { PrismaClient } from '../../../generated/prisma';
import { createDepositRepository } from '../deposit.repository';

const mockDeposit = {
  id: 'dep-1',
  userId: 'user-1',
  amount: { toNumber: (): number => 100 },
  cryptoAmount: { toNumber: (): number => 100 },
  cryptoCurrency: 'USDT',
  paymentAddress: '0xAddr',
  status: 'PENDING',
  txHash: null,
  expiresAt: new Date(),
  confirmedAt: null,
  ledgerEntryId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrisma(): {
  prisma: PrismaClient;
  create: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
} {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const update = jest.fn();
  const prisma = {
    deposit: { create, findFirst, findMany, count, update },
  } as unknown as PrismaClient;
  return { prisma, create, findFirst, findMany, count, update };
}

describe('Deposit Repository', () => {
  describe('createDeposit', () => {
    it('should create deposit with PENDING status', async () => {
      const { prisma, create } = makePrisma();
      create.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      const result = await repo.createDeposit({
        userId: 'user-1',
        amount: 100,
        cryptoAmount: 100,
        cryptoCurrency: 'USDT',
        paymentAddress: '0xAddr',
        expiresAt: new Date(),
      });

      expect(result.id).toBe('dep-1');
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'PENDING',
          cryptoCurrency: 'USDT',
        }),
      });
    });
  });

  describe('findDepositById', () => {
    it('should return deposit by id', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositById('dep-1');

      expect(result?.id).toBe('dep-1');
    });

    it('should filter by userId when provided', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      await repo.findDepositById('dep-1', 'user-1');

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1', userId: 'user-1' },
      });
    });

    it('should not include userId when not provided', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      await repo.findDepositById('dep-1');

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, findFirst } = makePrisma();
      findFirst.mockResolvedValue(null);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositById('dep-999');

      expect(result).toBeNull();
    });
  });

  describe('findDepositsByUserId', () => {
    it('should return paginated deposits', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([mockDeposit]);
      count.mockResolvedValue(1);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositsByUserId('user-1', { page: 1, limit: 20 });

      expect(result.deposits).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findDepositsByUserId('user-1', { status: 'CONFIRMED', page: 1, limit: 20 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'CONFIRMED' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findDepositsByUserId('user-1', { page: 3, limit: 10 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findDepositsByUserId('user-1', { page: 1, limit: 20 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('updateDepositStatus', () => {
    it('should update deposit status', async () => {
      const { prisma, update } = makePrisma();
      update.mockResolvedValue({ ...mockDeposit, status: 'CONFIRMED' });
      const repo = createDepositRepository(prisma);

      const result = await repo.updateDepositStatus('dep-1', {
        status: 'CONFIRMED',
        txHash: '0xTxHash',
        confirmedAt: new Date(),
        ledgerEntryId: 'ledger-1',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          txHash: '0xTxHash',
        }),
      });
    });

    it('should update to EXPIRED without txHash', async () => {
      const { prisma, update } = makePrisma();
      update.mockResolvedValue({ ...mockDeposit, status: 'EXPIRED' });
      const repo = createDepositRepository(prisma);

      await repo.updateDepositStatus('dep-1', { status: 'EXPIRED' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
