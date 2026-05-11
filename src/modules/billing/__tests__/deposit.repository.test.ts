import type { Prisma, PrismaClient } from '../../../generated/prisma';
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
  findUnique: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
} {
  const create = jest.fn();
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const count = jest.fn();
  const update = jest.fn();
  const prisma = {
    deposit: { create, findFirst, findMany, findUnique, count, update },
  } as unknown as PrismaClient;
  return { prisma, create, findFirst, findMany, findUnique, count, update };
}

function makeTx(): {
  tx: Prisma.TransactionClient;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
} {
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const tx = {
    deposit: { findFirst, findUnique, update },
  } as unknown as Prisma.TransactionClient;
  return { tx, findFirst, findUnique, update };
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

    it('should use transaction client when tx is provided', async () => {
      const { prisma, update: prismaUpdate } = makePrisma();
      const { tx, update: txUpdate } = makeTx();
      txUpdate.mockResolvedValue({ ...mockDeposit, status: 'CONFIRMED' });
      const repo = createDepositRepository(prisma);

      const result = await repo.updateDepositStatus(
        'dep-1',
        { status: 'CONFIRMED', txHash: '0x1', confirmedAt: new Date(), ledgerEntryId: 'l-1' },
        tx,
      );

      expect(result.status).toBe('CONFIRMED');
      expect(txUpdate).toHaveBeenCalledTimes(1);
      expect(prismaUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findDepositById with tx', () => {
    it('should use transaction client when tx is provided', async () => {
      const { prisma, findFirst: prismaFindFirst } = makePrisma();
      const { tx, findFirst: txFindFirst } = makeTx();
      txFindFirst.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositById('dep-1', undefined, tx);

      expect(result?.id).toBe('dep-1');
      expect(txFindFirst).toHaveBeenCalledWith({ where: { id: 'dep-1' } });
      expect(prismaFindFirst).not.toHaveBeenCalled();
    });

    it('should include userId in where clause when tx and userId provided', async () => {
      const { prisma } = makePrisma();
      const { tx, findFirst: txFindFirst } = makeTx();
      txFindFirst.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      await repo.findDepositById('dep-1', 'user-1', tx);

      expect(txFindFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1', userId: 'user-1' },
      });
    });
  });

  describe('findAllDeposits', () => {
    it('returns paginated deposits with empty filters', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([mockDeposit]);
      count.mockResolvedValue(1);
      const repo = createDepositRepository(prisma);

      const result = await repo.findAllDeposits({ page: 1, limit: 10 });

      expect(result).toEqual({ deposits: [mockDeposit], total: 1 });
      expect(findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(count).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by status and userId', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findAllDeposits({ status: 'CONFIRMED', userId: 'user-1', page: 2, limit: 5 });

      expect(findMany).toHaveBeenCalledWith({
        where: { status: 'CONFIRMED', userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
      expect(count).toHaveBeenCalledWith({ where: { status: 'CONFIRMED', userId: 'user-1' } });
    });

    it('filters by status only', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findAllDeposits({ status: 'EXPIRED', page: 1, limit: 20 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'EXPIRED' },
        }),
      );
    });

    it('filters by userId only', async () => {
      const { prisma, findMany, count } = makePrisma();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const repo = createDepositRepository(prisma);

      await repo.findAllDeposits({ userId: 'user-1', page: 1, limit: 20 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });
  });

  describe('findExpiredPendingDeposits', () => {
    it('returns PENDING deposits past expiresAt ordered asc', async () => {
      const { prisma, findMany } = makePrisma();
      findMany.mockResolvedValue([mockDeposit]);
      const repo = createDepositRepository(prisma);

      const result = await repo.findExpiredPendingDeposits();

      expect(result).toEqual([mockDeposit]);
      expect(findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lt: expect.any(Date) },
        },
        orderBy: { expiresAt: 'asc' },
        take: 200,
      });
    });
  });

  describe('updateDepositStripeSession', () => {
    it('sets stripeSessionId and payment method STRIPE', async () => {
      const { prisma, update } = makePrisma();
      update.mockResolvedValue({ ...mockDeposit, stripeSessionId: 'sess_1' });
      const repo = createDepositRepository(prisma);

      await repo.updateDepositStripeSession('dep-1', 'sess_1');

      expect(update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { stripeSessionId: 'sess_1', paymentMethod: 'STRIPE' },
      });
    });
  });

  describe('updateDepositCryptomusOrder', () => {
    it('sets cryptomus order fields and payment method CRYPTOMUS', async () => {
      const { prisma, update } = makePrisma();
      update.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      await repo.updateDepositCryptomusOrder('dep-1', {
        cryptomusOrderId: 'crypto-1',
        cryptomusCheckoutUrl: 'https://pay.cryptomus.com/abc',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          cryptomusOrderId: 'crypto-1',
          cryptomusCheckoutUrl: 'https://pay.cryptomus.com/abc',
          paymentMethod: 'CRYPTOMUS',
        },
      });
    });
  });

  describe('findDepositByCryptomusOrderId', () => {
    it('returns deposit when found via prisma', async () => {
      const { prisma, findUnique } = makePrisma();
      findUnique.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositByCryptomusOrderId('crypto-1');

      expect(result?.id).toBe('dep-1');
      expect(findUnique).toHaveBeenCalledWith({ where: { cryptomusOrderId: 'crypto-1' } });
    });

    it('returns null when not found', async () => {
      const { prisma, findUnique } = makePrisma();
      findUnique.mockResolvedValue(null);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositByCryptomusOrderId('missing');

      expect(result).toBeNull();
    });

    it('uses transaction client when tx is provided', async () => {
      const { prisma, findUnique: prismaFindUnique } = makePrisma();
      const { tx, findUnique: txFindUnique } = makeTx();
      txFindUnique.mockResolvedValue(mockDeposit);
      const repo = createDepositRepository(prisma);

      const result = await repo.findDepositByCryptomusOrderId('crypto-1', tx);

      expect(result?.id).toBe('dep-1');
      expect(txFindUnique).toHaveBeenCalledWith({ where: { cryptomusOrderId: 'crypto-1' } });
      expect(prismaFindUnique).not.toHaveBeenCalled();
    });
  });
});
