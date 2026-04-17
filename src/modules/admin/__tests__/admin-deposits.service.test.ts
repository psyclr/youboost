import {
  listAllDeposits,
  adminConfirmDeposit,
  adminExpireDeposit,
} from '../admin-deposits.service';

const mockFindDepositById = jest.fn();
const mockFindAllDeposits = jest.fn();
const mockUpdateDepositStatus = jest.fn();

jest.mock('../../billing/deposit.repository', () => ({
  findDepositById: (...args: unknown[]): unknown => mockFindDepositById(...args),
  findAllDeposits: (...args: unknown[]): unknown => mockFindAllDeposits(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockUpdateDepositStatus(...args),
}));

const mockGetOrCreateWallet = jest.fn();
const mockUpdateBalance = jest.fn();

jest.mock('../../billing/wallet.repository', () => ({
  getOrCreateWallet: (...args: unknown[]): unknown => mockGetOrCreateWallet(...args),
  updateBalance: (...args: unknown[]): unknown => mockUpdateBalance(...args),
}));

const mockCreateLedgerEntry = jest.fn();

jest.mock('../../billing/ledger.repository', () => ({
  createLedgerEntry: (...args: unknown[]): unknown => mockCreateLedgerEntry(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockDeposit = {
  id: 'dep-1',
  userId: 'user-1',
  amount: 100,
  cryptoAmount: 95.5,
  cryptoCurrency: 'USDT',
  paymentAddress: 'TXyz123abc',
  status: 'PENDING',
  txHash: null,
  expiresAt: new Date('2024-01-02'),
  confirmedAt: null,
  ledgerEntryId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Admin Deposits Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllDeposits', () => {
    it('should return paginated list with Decimal fields mapped to numbers and userId included', async () => {
      mockFindAllDeposits.mockResolvedValue({ deposits: [mockDeposit], total: 1 });

      const result = await listAllDeposits({ page: 1, limit: 20 });

      expect(result.deposits).toHaveLength(1);
      const first = result.deposits[0]!;
      expect(first.id).toBe('dep-1');
      expect(first.userId).toBe('user-1');
      expect(first.amount).toBe(100);
      expect(typeof first.amount).toBe('number');
      expect(first.cryptoAmount).toBe(95.5);
      expect(typeof first.cryptoAmount).toBe('number');
      expect(first.cryptoCurrency).toBe('USDT');
      expect(first.status).toBe('PENDING');
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('should pass status filter to repository', async () => {
      mockFindAllDeposits.mockResolvedValue({ deposits: [], total: 0 });

      await listAllDeposits({ page: 1, limit: 20, status: 'CONFIRMED' });

      expect(mockFindAllDeposits).toHaveBeenCalledWith({
        status: 'CONFIRMED',
        userId: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('adminConfirmDeposit', () => {
    it('should confirm pending deposit, credit wallet, and create ledger entry', async () => {
      mockFindDepositById.mockResolvedValue(mockDeposit);
      mockGetOrCreateWallet.mockResolvedValue({
        id: 'wallet-1',
        userId: 'user-1',
        balance: 50,
        holdAmount: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockUpdateBalance.mockResolvedValue(undefined);
      mockCreateLedgerEntry.mockResolvedValue({
        id: 'ledger-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        type: 'DEPOSIT',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        referenceType: 'deposit',
        referenceId: 'dep-1',
        description: 'Admin-confirmed deposit $100',
        metadata: null,
        createdAt: new Date(),
      });
      const confirmedDeposit = {
        ...mockDeposit,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        ledgerEntryId: 'ledger-1',
      };
      mockUpdateDepositStatus.mockResolvedValue(confirmedDeposit);

      const result = await adminConfirmDeposit('dep-1');

      expect(result.status).toBe('CONFIRMED');
      expect(result.amount).toBe(100);
      expect(mockGetOrCreateWallet).toHaveBeenCalledWith('user-1');
      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 150,
        newHold: 0,
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith({
        userId: 'user-1',
        walletId: 'wallet-1',
        type: 'DEPOSIT',
        amount: 100,
        balanceBefore: 50,
        balanceAfter: 150,
        referenceType: 'deposit',
        referenceId: 'dep-1',
        description: 'Admin-confirmed deposit $100',
      });
      expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-1', {
        status: 'CONFIRMED',
        confirmedAt: expect.any(Date),
        ledgerEntryId: 'ledger-1',
      });
    });

    it('should throw NotFoundError if deposit not found', async () => {
      mockFindDepositById.mockResolvedValue(null);

      await expect(adminConfirmDeposit('nonexistent')).rejects.toThrow('Deposit not found');
    });

    it('should throw ValidationError if deposit is not PENDING', async () => {
      mockFindDepositById.mockResolvedValue({ ...mockDeposit, status: 'CONFIRMED' });

      await expect(adminConfirmDeposit('dep-1')).rejects.toThrow('Deposit is not pending');
    });
  });

  describe('adminExpireDeposit', () => {
    it('should expire pending deposit', async () => {
      mockFindDepositById.mockResolvedValue(mockDeposit);
      const expiredDeposit = { ...mockDeposit, status: 'EXPIRED' };
      mockUpdateDepositStatus.mockResolvedValue(expiredDeposit);

      const result = await adminExpireDeposit('dep-1');

      expect(result.status).toBe('EXPIRED');
      expect(mockUpdateDepositStatus).toHaveBeenCalledWith('dep-1', { status: 'EXPIRED' });
    });

    it('should throw NotFoundError if deposit not found', async () => {
      mockFindDepositById.mockResolvedValue(null);

      await expect(adminExpireDeposit('nonexistent')).rejects.toThrow('Deposit not found');
    });

    it('should throw ValidationError if deposit is not PENDING', async () => {
      mockFindDepositById.mockResolvedValue({ ...mockDeposit, status: 'EXPIRED' });

      await expect(adminExpireDeposit('dep-1')).rejects.toThrow('Deposit is not pending');
    });
  });
});
