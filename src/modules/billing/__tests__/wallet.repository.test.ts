import { getOrCreateWallet, findWalletByUserId, updateBalance } from '../wallet.repository';

const mockWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  balance: { toNumber: (): number => 100 },
  currency: 'USD',
  holdAmount: { toNumber: (): number => 10 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUpsert = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    wallet: {
      upsert: (...args: unknown[]): unknown => mockUpsert(...args),
      findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

describe('Wallet Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateWallet', () => {
    it('should upsert and return wallet', async () => {
      mockUpsert.mockResolvedValue(mockWallet);
      const result = await getOrCreateWallet('user-1');
      expect(result).toEqual(mockWallet);
      expect(mockUpsert).toHaveBeenCalledWith({
        where: { userId_currency: { userId: 'user-1', currency: 'USD' } },
        create: { userId: 'user-1', currency: 'USD' },
        update: {},
      });
    });

    it('should use custom currency', async () => {
      mockUpsert.mockResolvedValue(mockWallet);
      await getOrCreateWallet('user-1', 'EUR');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_currency: { userId: 'user-1', currency: 'EUR' } },
        }),
      );
    });

    it('should handle race condition by finding existing wallet', async () => {
      mockUpsert.mockRejectedValue(new Error('unique constraint'));
      mockFindUnique.mockResolvedValue(mockWallet);
      const result = await getOrCreateWallet('user-1');
      expect(result).toEqual(mockWallet);
    });

    it('should throw if wallet not found after failed upsert', async () => {
      mockUpsert.mockRejectedValue(new Error('unique constraint'));
      mockFindUnique.mockResolvedValue(null);
      await expect(getOrCreateWallet('user-1')).rejects.toThrow('Failed to create or find wallet');
    });
  });

  describe('findWalletByUserId', () => {
    it('should find wallet by userId', async () => {
      mockFindUnique.mockResolvedValue(mockWallet);
      const result = await findWalletByUserId('user-1');
      expect(result).toEqual(mockWallet);
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await findWalletByUserId('user-2');
      expect(result).toBeNull();
    });
  });

  describe('updateBalance', () => {
    it('should update wallet balance and hold', async () => {
      mockUpdate.mockResolvedValue(mockWallet);
      const result = await updateBalance({ walletId: 'wallet-1', newBalance: 200, newHold: 20 });
      expect(result).toEqual(mockWallet);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
        data: { balance: 200, holdAmount: 20 },
      });
    });

    it('should use transaction client if provided', async () => {
      const txUpdate = jest.fn().mockResolvedValue(mockWallet);
      const txClient = { wallet: { update: txUpdate } };
      await updateBalance({
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
