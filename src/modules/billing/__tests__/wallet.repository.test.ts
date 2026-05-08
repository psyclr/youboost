import type { PrismaClient } from '../../../generated/prisma';
import { createWalletRepository } from '../wallet.repository';

const mockWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  balance: { toNumber: (): number => 100 },
  currency: 'USD',
  holdAmount: { toNumber: (): number => 10 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePrisma(): {
  prisma: PrismaClient;
  upsert: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
} {
  const upsert = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    wallet: { upsert, findUnique, update },
  } as unknown as PrismaClient;
  return { prisma, upsert, findUnique, update };
}

describe('Wallet Repository', () => {
  describe('getOrCreateWallet', () => {
    it('should upsert and return wallet', async () => {
      const { prisma, upsert } = makePrisma();
      upsert.mockResolvedValue(mockWallet);
      const repo = createWalletRepository(prisma);

      const result = await repo.getOrCreateWallet('user-1');

      expect(result).toEqual(mockWallet);
      expect(upsert).toHaveBeenCalledWith({
        where: { userId_currency: { userId: 'user-1', currency: 'USD' } },
        create: { userId: 'user-1', currency: 'USD' },
        update: {},
      });
    });

    it('should use custom currency', async () => {
      const { prisma, upsert } = makePrisma();
      upsert.mockResolvedValue(mockWallet);
      const repo = createWalletRepository(prisma);

      await repo.getOrCreateWallet('user-1', 'EUR');

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_currency: { userId: 'user-1', currency: 'EUR' } },
        }),
      );
    });

    it('should handle race condition by finding existing wallet', async () => {
      const { prisma, upsert, findUnique } = makePrisma();
      upsert.mockRejectedValue(new Error('unique constraint'));
      findUnique.mockResolvedValue(mockWallet);
      const repo = createWalletRepository(prisma);

      const result = await repo.getOrCreateWallet('user-1');

      expect(result).toEqual(mockWallet);
    });

    it('should throw if wallet not found after failed upsert', async () => {
      const { prisma, upsert, findUnique } = makePrisma();
      upsert.mockRejectedValue(new Error('unique constraint'));
      findUnique.mockResolvedValue(null);
      const repo = createWalletRepository(prisma);

      await expect(repo.getOrCreateWallet('user-1')).rejects.toThrow(
        'Failed to create or find wallet',
      );
    });
  });

  describe('findWalletByUserId', () => {
    it('should find wallet by userId', async () => {
      const { prisma, findUnique } = makePrisma();
      findUnique.mockResolvedValue(mockWallet);
      const repo = createWalletRepository(prisma);

      const result = await repo.findWalletByUserId('user-1');

      expect(result).toEqual(mockWallet);
    });

    it('should return null when not found', async () => {
      const { prisma, findUnique } = makePrisma();
      findUnique.mockResolvedValue(null);
      const repo = createWalletRepository(prisma);

      const result = await repo.findWalletByUserId('user-2');

      expect(result).toBeNull();
    });
  });

  describe('updateBalance', () => {
    it('should update wallet balance and hold', async () => {
      const { prisma, update } = makePrisma();
      update.mockResolvedValue(mockWallet);
      const repo = createWalletRepository(prisma);

      const result = await repo.updateBalance({
        walletId: 'wallet-1',
        newBalance: 200,
        newHold: 20,
      });

      expect(result).toEqual(mockWallet);
      expect(update).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
        data: { balance: 200, holdAmount: 20 },
      });
    });

    it('should use transaction client if provided', async () => {
      const { prisma } = makePrisma();
      const txUpdate = jest.fn().mockResolvedValue(mockWallet);
      const txClient = { wallet: { update: txUpdate } };
      const repo = createWalletRepository(prisma);

      await repo.updateBalance({
        walletId: 'wallet-1',
        newBalance: 150,
        newHold: 15,
        tx: txClient as never,
      });

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
        data: { balance: 150, holdAmount: 15 },
      });
    });
  });
});
