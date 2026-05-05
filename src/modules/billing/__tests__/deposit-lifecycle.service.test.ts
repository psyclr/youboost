jest.mock('../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    billing: { minDeposit: 5, maxDeposit: 10_000, depositExpiryMs: 3_600_000 },
  }),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockFindDepositById = jest.fn();
const mockCreateDeposit = jest.fn();
const mockUpdateDepositStatus = jest.fn();
jest.mock('../deposit.repository', () => ({
  findDepositById: (...args: unknown[]): unknown => mockFindDepositById(...args),
  createDeposit: (...args: unknown[]): unknown => mockCreateDeposit(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockUpdateDepositStatus(...args),
}));

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

let transactionCallCount = 0;
jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    $transaction: async (fn: (tx: unknown) => unknown) => {
      transactionCallCount++;
      return fn({});
    },
  }),
}));

import {
  prepareDepositCheckout,
  confirmDepositTransaction,
  failDepositTransaction,
} from '../deposit-lifecycle.service';

describe('deposit-lifecycle.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionCallCount = 0;
  });

  describe('prepareDepositCheckout', () => {
    it('rejects amount below configured min', async () => {
      await expect(prepareDepositCheckout('u1', 4)).rejects.toThrow(/Minimum deposit/);
    });

    it('rejects amount above configured max', async () => {
      await expect(prepareDepositCheckout('u1', 10_001)).rejects.toThrow(/Maximum deposit/);
    });

    it('creates a deposit with configured expiry', async () => {
      mockGetOrCreateWallet.mockResolvedValue({ id: 'w1' });
      mockCreateDeposit.mockResolvedValue({ id: 'd1' });

      const result = await prepareDepositCheckout('u1', 25);

      expect(mockGetOrCreateWallet).toHaveBeenCalledWith('u1');
      expect(mockCreateDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          amount: 25,
          expiresAt: expect.any(Date),
        }),
      );
      expect(result.id).toBe('d1');
    });
  });

  describe('confirmDepositTransaction', () => {
    it('credits wallet and marks deposit CONFIRMED in a single tx', async () => {
      mockFindDepositById.mockResolvedValue({
        id: 'd1',
        userId: 'u1',
        amount: 25,
        status: 'PENDING',
      });
      mockGetOrCreateWallet.mockResolvedValue({ id: 'w1', balance: 0, holdAmount: 0 });
      mockCreateLedgerEntry.mockResolvedValue({ id: 'l1' });

      await confirmDepositTransaction('d1', 'u1', 'Stripe');

      expect(transactionCallCount).toBe(1);
      expect(mockUpdateBalance).toHaveBeenCalledWith(expect.objectContaining({ newBalance: 25 }));
      expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ status: 'CONFIRMED' }),
        expect.anything(),
      );
    });

    it('is idempotent on already-CONFIRMED deposit', async () => {
      mockFindDepositById.mockResolvedValue({
        id: 'd1',
        userId: 'u1',
        amount: 25,
        status: 'CONFIRMED',
      });

      await confirmDepositTransaction('d1', 'u1', 'Stripe');

      expect(mockUpdateBalance).not.toHaveBeenCalled();
      expect(mockCreateLedgerEntry).not.toHaveBeenCalled();
      expect(mockUpdateDepositStatus).not.toHaveBeenCalled();
    });

    it('ignores unknown deposit', async () => {
      mockFindDepositById.mockResolvedValue(null);

      await confirmDepositTransaction('missing', 'u1', 'Stripe');

      expect(mockUpdateBalance).not.toHaveBeenCalled();
    });

    it('writes provider label into ledger description', async () => {
      mockFindDepositById.mockResolvedValue({
        id: 'd1',
        userId: 'u1',
        amount: 25,
        status: 'PENDING',
      });
      mockGetOrCreateWallet.mockResolvedValue({ id: 'w1', balance: 0, holdAmount: 0 });
      mockCreateLedgerEntry.mockResolvedValue({ id: 'l1' });

      await confirmDepositTransaction('d1', 'u1', 'Cryptomus');

      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Cryptomus deposit $25.00' }),
        expect.anything(),
      );
    });
  });

  describe('failDepositTransaction', () => {
    it('marks PENDING deposit as FAILED', async () => {
      mockFindDepositById.mockResolvedValue({ id: 'd1', status: 'PENDING' });

      await failDepositTransaction('d1', 'Cryptomus', 'fail');

      expect(mockUpdateDepositStatus).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ status: 'FAILED' }),
        expect.anything(),
      );
    });

    it('is idempotent on non-PENDING deposit', async () => {
      mockFindDepositById.mockResolvedValue({ id: 'd1', status: 'CONFIRMED' });

      await failDepositTransaction('d1', 'Cryptomus', 'fail');

      expect(mockUpdateDepositStatus).not.toHaveBeenCalled();
    });
  });
});
