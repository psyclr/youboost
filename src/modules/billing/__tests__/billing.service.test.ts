import { getBalance, createDeposit, getTransactions, getTransactionById } from '../billing.service';

const mockGetOrCreateWallet = jest.fn();
const mockFindWalletByUserId = jest.fn();

jest.mock('../wallet.repository', () => ({
  getOrCreateWallet: (...args: unknown[]): unknown => mockGetOrCreateWallet(...args),
  findWalletByUserId: (...args: unknown[]): unknown => mockFindWalletByUserId(...args),
  updateBalance: jest.fn(),
}));

const mockCreateLedgerEntry = jest.fn();
const mockFindLedgerById = jest.fn();
const mockFindLedgerEntries = jest.fn();

jest.mock('../ledger.repository', () => ({
  createLedgerEntry: (...args: unknown[]): unknown => mockCreateLedgerEntry(...args),
  findLedgerById: (...args: unknown[]): unknown => mockFindLedgerById(...args),
  findLedgerEntries: (...args: unknown[]): unknown => mockFindLedgerEntries(...args),
}));

const mockCreatePayment = jest.fn();

jest.mock('../utils/stub-payment-gateway', () => ({
  paymentGateway: {
    createPayment: (...args: unknown[]): unknown => mockCreatePayment(...args),
  },
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
  holdAmount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockLedger = {
  id: 'ledger-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  type: 'DEPOSIT',
  amount: 50,
  balanceBefore: 0,
  balanceAfter: 50,
  referenceType: null,
  referenceId: null,
  description: 'Test deposit',
  metadata: null,
  createdAt: new Date(),
};

describe('Billing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return balance with available computed', async () => {
      mockGetOrCreateWallet.mockResolvedValue(mockWallet);

      const result = await getBalance('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.balance).toBe(100);
      expect(result.frozen).toBe(10);
      expect(result.available).toBe(90);
      expect(result.currency).toBe('USD');
    });

    it('should create wallet for new user', async () => {
      mockGetOrCreateWallet.mockResolvedValue({ ...mockWallet, balance: 0, holdAmount: 0 });

      const result = await getBalance('new-user');

      expect(mockGetOrCreateWallet).toHaveBeenCalledWith('new-user');
      expect(result.balance).toBe(0);
      expect(result.available).toBe(0);
    });
  });

  describe('createDeposit', () => {
    const depositInput = {
      amount: 50,
      currency: 'USD' as const,
      paymentMethod: 'crypto' as const,
      cryptoCurrency: 'USDT' as const,
    };

    it('should create deposit and return payment info', async () => {
      mockGetOrCreateWallet.mockResolvedValue(mockWallet);
      mockCreatePayment.mockResolvedValue({
        paymentAddress: '0xAddr',
        cryptoAmount: 50,
        expiresAt: new Date('2030-01-01'),
        qrCode: 'https://qr.example.com',
      });
      mockCreateLedgerEntry.mockResolvedValue({ ...mockLedger, id: 'deposit-1' });

      const result = await createDeposit('user-1', depositInput);

      expect(result.depositId).toBe('deposit-1');
      expect(result.paymentAddress).toBe('0xAddr');
      expect(result.amount).toBe(50);
      expect(result.cryptoAmount).toBe(50);
      expect(result.status).toBe('pending');
    });

    it('should call payment gateway with correct params', async () => {
      mockGetOrCreateWallet.mockResolvedValue(mockWallet);
      mockCreatePayment.mockResolvedValue({
        paymentAddress: '0x',
        cryptoAmount: 1,
        expiresAt: new Date(),
        qrCode: 'qr',
      });
      mockCreateLedgerEntry.mockResolvedValue(mockLedger);

      await createDeposit('user-1', depositInput);

      expect(mockCreatePayment).toHaveBeenCalledWith({
        amount: 50,
        currency: 'USD',
        cryptoCurrency: 'USDT',
      });
    });

    it('should create ledger entry with DEPOSIT type', async () => {
      mockGetOrCreateWallet.mockResolvedValue(mockWallet);
      mockCreatePayment.mockResolvedValue({
        paymentAddress: '0x',
        cryptoAmount: 1,
        expiresAt: new Date(),
        qrCode: 'qr',
      });
      mockCreateLedgerEntry.mockResolvedValue(mockLedger);

      await createDeposit('user-1', depositInput);

      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DEPOSIT', amount: 50, userId: 'user-1' }),
      );
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      mockFindLedgerEntries.mockResolvedValue({
        entries: [mockLedger],
        total: 1,
      });

      const result = await getTransactions('user-1', { page: 1, limit: 20 });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]?.id).toBe('ledger-1');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass type filter', async () => {
      mockFindLedgerEntries.mockResolvedValue({ entries: [], total: 0 });

      await getTransactions('user-1', { page: 1, limit: 20, type: 'HOLD' });

      expect(mockFindLedgerEntries).toHaveBeenCalledWith('user-1', {
        type: 'HOLD',
        page: 1,
        limit: 20,
      });
    });

    it('should calculate correct totalPages', async () => {
      mockFindLedgerEntries.mockResolvedValue({ entries: [], total: 45 });

      const result = await getTransactions('user-1', { page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty transactions array when none found', async () => {
      mockFindLedgerEntries.mockResolvedValue({ entries: [], total: 0 });

      const result = await getTransactions('user-1', { page: 1, limit: 20 });

      expect(result.transactions).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getTransactionById', () => {
    it('should return detailed transaction', async () => {
      mockFindLedgerById.mockResolvedValue(mockLedger);

      const result = await getTransactionById('user-1', 'ledger-1');

      expect(result.id).toBe('ledger-1');
      expect(result.amount).toBe(50);
      expect(result.balanceBefore).toBe(0);
      expect(result.balanceAfter).toBe(50);
    });

    it('should throw NotFoundError if not found', async () => {
      mockFindLedgerById.mockResolvedValue(null);

      await expect(getTransactionById('user-1', 'bad-id')).rejects.toThrow('Transaction not found');
    });

    it('should pass userId for authorization scoping', async () => {
      mockFindLedgerById.mockResolvedValue(mockLedger);

      await getTransactionById('user-1', 'ledger-1');

      expect(mockFindLedgerById).toHaveBeenCalledWith('ledger-1', 'user-1');
    });
  });
});
