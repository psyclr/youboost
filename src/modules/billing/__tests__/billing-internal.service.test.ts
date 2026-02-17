import {
  holdFunds,
  releaseFunds,
  chargeFunds,
  refundFunds,
  adjustBalance,
} from '../billing-internal.service';

const mockGetOrCreateWallet = jest.fn();
const mockUpdateBalance = jest.fn();

jest.mock('../wallet.repository', () => ({
  getOrCreateWallet: (...args: unknown[]): unknown => mockGetOrCreateWallet(...args),
  updateBalance: (...args: unknown[]): unknown => mockUpdateBalance(...args),
}));

const mockCreateLedgerEntry = jest.fn();

jest.mock('../ledger.repository', () => ({
  createLedgerEntry: (...args: unknown[]): unknown => mockCreateLedgerEntry(...args),
}));

const mockTransaction = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    $transaction: (...args: unknown[]): unknown => mockTransaction(...args),
  }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockWallet = {
  id: 'wallet-1',
  userId: 'user-1',
  balance: 100,
  currency: 'USD',
  holdAmount: 20,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Billing Internal Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) =>
      cb('tx-client'),
    );
    mockGetOrCreateWallet.mockResolvedValue(mockWallet);
    mockUpdateBalance.mockResolvedValue(mockWallet);
    mockCreateLedgerEntry.mockResolvedValue({ id: 'ledger-1' });
  });

  describe('holdFunds', () => {
    it('should hold funds when available balance is sufficient', async () => {
      await holdFunds('user-1', 30, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 100,
        newHold: 50,
        tx: 'tx-client',
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'HOLD', amount: 30, referenceId: 'order-1' }),
        'tx-client',
      );
    });

    it('should throw when available balance is insufficient', async () => {
      await expect(holdFunds('user-1', 90, 'order-1')).rejects.toThrow('Insufficient funds');
    });

    it('should hold exact available amount', async () => {
      await holdFunds('user-1', 80, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 100,
        newHold: 100,
        tx: 'tx-client',
      });
    });

    it('should set referenceType to order', async () => {
      await holdFunds('user-1', 10, 'order-1');

      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ referenceType: 'order' }),
        'tx-client',
      );
    });
  });

  describe('releaseFunds', () => {
    it('should release funds and decrease hold', async () => {
      await releaseFunds('user-1', 10, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 100,
        newHold: 10,
        tx: 'tx-client',
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'RELEASE', amount: 10 }),
        'tx-client',
      );
    });

    it('should throw when hold is insufficient', async () => {
      await expect(releaseFunds('user-1', 30, 'order-1')).rejects.toThrow('Insufficient hold');
    });

    it('should release exact hold amount', async () => {
      await releaseFunds('user-1', 20, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 100,
        newHold: 0,
        tx: 'tx-client',
      });
    });
  });

  describe('chargeFunds', () => {
    it('should charge funds by decreasing balance and hold', async () => {
      await chargeFunds('user-1', 15, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 85,
        newHold: 5,
        tx: 'tx-client',
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WITHDRAW',
          amount: 15,
          balanceBefore: 100,
          balanceAfter: 85,
        }),
        'tx-client',
      );
    });

    it('should throw when hold is insufficient for charge', async () => {
      await expect(chargeFunds('user-1', 25, 'order-1')).rejects.toThrow('Insufficient hold');
    });

    it('should charge exact hold amount', async () => {
      await chargeFunds('user-1', 20, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 80,
        newHold: 0,
        tx: 'tx-client',
      });
    });
  });

  describe('refundFunds', () => {
    it('should refund by increasing balance', async () => {
      await refundFunds('user-1', 25, 'order-1');

      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 125,
        newHold: 20,
        tx: 'tx-client',
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFUND',
          amount: 25,
          balanceBefore: 100,
          balanceAfter: 125,
        }),
        'tx-client',
      );
    });

    it('should set correct description', async () => {
      await refundFunds('user-1', 10, 'order-99');

      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Refund 10 for order order-99' }),
        'tx-client',
      );
    });

    it('should not change hold amount on refund', async () => {
      await refundFunds('user-1', 10, 'order-1');
      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 110,
        newHold: 20,
        tx: 'tx-client',
      });
    });
  });

  describe('adjustBalance', () => {
    it('should increase balance with positive amount', async () => {
      await adjustBalance('user-1', 50, 'Bonus');
      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 150,
        newHold: 20,
        tx: 'tx-client',
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADMIN_ADJUSTMENT',
          amount: 50,
          balanceAfter: 150,
          description: 'Bonus',
        }),
        'tx-client',
      );
    });

    it('should decrease balance with negative amount', async () => {
      await adjustBalance('user-1', -30, 'Penalty');
      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 70,
        newHold: 20,
        tx: 'tx-client',
      });
    });

    it('should throw when negative adjustment exceeds balance', async () => {
      await expect(adjustBalance('user-1', -200, 'Too much')).rejects.toThrow('Insufficient funds');
    });

    it('should use referenceType admin', async () => {
      await adjustBalance('user-1', 10, 'Test');
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ referenceType: 'admin' }),
        'tx-client',
      );
    });
  });
});
