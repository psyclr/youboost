import {
  createDeposit,
  initiateDeposit,
  confirmDeposit,
  listDeposits,
  getDeposit,
} from '../billing.service';

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

const mockDepositCreate = jest.fn();
const mockDepositFindById = jest.fn();
const mockDepositFindByUserId = jest.fn();
const mockDepositUpdateStatus = jest.fn();
jest.mock('../deposit.repository', () => ({
  createDeposit: (...args: unknown[]): unknown => mockDepositCreate(...args),
  findDepositById: (...args: unknown[]): unknown => mockDepositFindById(...args),
  findDepositsByUserId: (...args: unknown[]): unknown => mockDepositFindByUserId(...args),
  updateDepositStatus: (...args: unknown[]): unknown => mockDepositUpdateStatus(...args),
}));

const mockCreatePayment = jest.fn();
jest.mock('../utils/stub-payment-gateway', () => ({
  paymentGateway: { createPayment: (...args: unknown[]): unknown => mockCreatePayment(...args) },
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
const mockPayment = {
  paymentAddress: '0xAddr',
  cryptoAmount: 50,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  qrCode: 'https://qr',
};
const mockDepositRecord = {
  id: 'dep-1',
  userId: 'user-1',
  amount: 50,
  cryptoAmount: 50,
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
const depositInput = {
  amount: 50,
  currency: 'USD' as const,
  paymentMethod: 'crypto' as const,
  cryptoCurrency: 'USDT' as const,
};

function setupConfirmMocks(): void {
  mockDepositFindById.mockResolvedValue(mockDepositRecord);
  mockUpdateBalance.mockResolvedValue(mockWallet);
  mockCreateLedgerEntry.mockResolvedValue({ id: 'ledger-1' });
  mockDepositUpdateStatus.mockResolvedValue({ ...mockDepositRecord, status: 'CONFIRMED' });
}

describe('Deposit Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateWallet.mockResolvedValue(mockWallet);
    mockCreatePayment.mockResolvedValue(mockPayment);
  });

  describe('createDeposit (legacy)', () => {
    it('should create deposit via payment gateway', async () => {
      mockDepositCreate.mockResolvedValue(mockDepositRecord);
      const result = await createDeposit('user-1', depositInput);
      expect(result.depositId).toBe('dep-1');
      expect(result.paymentAddress).toBe('0xAddr');
      expect(result.status).toBe('pending');
      expect(mockCreatePayment).toHaveBeenCalledWith({
        amount: 50,
        currency: 'USD',
        cryptoCurrency: 'USDT',
      });
    });

    it('should create deposit record and ensure wallet', async () => {
      mockDepositCreate.mockResolvedValue(mockDepositRecord);
      await createDeposit('user-1', depositInput);
      expect(mockDepositCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', amount: 50 }),
      );
      expect(mockGetOrCreateWallet).toHaveBeenCalledWith('user-1');
    });
  });

  describe('initiateDeposit', () => {
    it('should create deposit with payment gateway', async () => {
      mockDepositCreate.mockResolvedValue(mockDepositRecord);
      const result = await initiateDeposit('user-1', { amount: 50, cryptoCurrency: 'USDT' });
      expect(result.id).toBe('dep-1');
      expect(result.status).toBe('PENDING');
      expect(result.paymentAddress).toBe('0xAddr');
      expect(result.txHash).toBeNull();
      expect(result.confirmedAt).toBeNull();
    });

    it('should call payment gateway with USD currency', async () => {
      mockDepositCreate.mockResolvedValue(mockDepositRecord);
      await initiateDeposit('user-1', { amount: 100, cryptoCurrency: 'BTC' });
      expect(mockCreatePayment).toHaveBeenCalledWith({
        amount: 100,
        currency: 'USD',
        cryptoCurrency: 'BTC',
      });
    });
  });

  describe('confirmDeposit', () => {
    it('should confirm deposit and credit wallet', async () => {
      setupConfirmMocks();
      mockDepositUpdateStatus.mockResolvedValue({
        ...mockDepositRecord,
        status: 'CONFIRMED',
        txHash: '0xTxHash',
      });
      const result = await confirmDeposit('dep-1', { txHash: '0xTxHash' }, 'user-1');
      expect(result.status).toBe('CONFIRMED');
      expect(result.txHash).toBe('0xTxHash');
    });

    it('should update wallet balance and create ledger entry', async () => {
      setupConfirmMocks();
      await confirmDeposit('dep-1', { txHash: '0xTxHash' }, 'user-1');
      expect(mockUpdateBalance).toHaveBeenCalledWith({
        walletId: 'wallet-1',
        newBalance: 150,
        newHold: 10,
      });
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'DEPOSIT',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 150,
        }),
      );
    });

    it('should throw NotFoundError when deposit not found', async () => {
      mockDepositFindById.mockResolvedValue(null);
      await expect(confirmDeposit('dep-999', { txHash: '0x' }, 'user-1')).rejects.toThrow(
        'Deposit not found',
      );
    });

    it('should throw ValidationError when deposit is not PENDING', async () => {
      mockDepositFindById.mockResolvedValue({ ...mockDepositRecord, status: 'CONFIRMED' });
      await expect(confirmDeposit('dep-1', { txHash: '0x' }, 'user-1')).rejects.toThrow(
        'Deposit cannot be confirmed',
      );
    });

    it('should update deposit status with ledgerEntryId', async () => {
      setupConfirmMocks();
      mockCreateLedgerEntry.mockResolvedValue({ id: 'ledger-42' });
      await confirmDeposit('dep-1', { txHash: '0xTx' }, 'user-1');
      expect(mockDepositUpdateStatus).toHaveBeenCalledWith('dep-1', {
        status: 'CONFIRMED',
        txHash: '0xTx',
        confirmedAt: expect.any(Date),
        ledgerEntryId: 'ledger-42',
      });
    });
  });

  describe('listDeposits', () => {
    it('should return paginated deposits', async () => {
      mockDepositFindByUserId.mockResolvedValue({ deposits: [mockDepositRecord], total: 1 });
      const result = await listDeposits('user-1', { page: 1, limit: 20 });
      expect(result.deposits).toHaveLength(1);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('should pass status filter', async () => {
      mockDepositFindByUserId.mockResolvedValue({ deposits: [], total: 0 });
      await listDeposits('user-1', { page: 1, limit: 20, status: 'CONFIRMED' });
      expect(mockDepositFindByUserId).toHaveBeenCalledWith('user-1', {
        status: 'CONFIRMED',
        page: 1,
        limit: 20,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockDepositFindByUserId.mockResolvedValue({ deposits: [], total: 45 });
      const result = await listDeposits('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should map deposit fields correctly', async () => {
      mockDepositFindByUserId.mockResolvedValue({ deposits: [mockDepositRecord], total: 1 });
      const result = await listDeposits('user-1', { page: 1, limit: 20 });
      const first = result.deposits[0];
      expect(first).toEqual(
        expect.objectContaining({
          id: 'dep-1',
          amount: 50,
          cryptoCurrency: 'USDT',
          status: 'PENDING',
        }),
      );
    });

    it('should return empty array when no deposits', async () => {
      mockDepositFindByUserId.mockResolvedValue({ deposits: [], total: 0 });
      const result = await listDeposits('user-1', { page: 1, limit: 20 });
      expect(result.deposits).toHaveLength(0);
    });
  });

  describe('getDeposit', () => {
    it('should return deposit detail', async () => {
      mockDepositFindById.mockResolvedValue(mockDepositRecord);
      const result = await getDeposit('dep-1', 'user-1');
      expect(result.id).toBe('dep-1');
      expect(result.amount).toBe(50);
      expect(mockDepositFindById).toHaveBeenCalledWith('dep-1', 'user-1');
    });

    it('should throw NotFoundError when not found', async () => {
      mockDepositFindById.mockResolvedValue(null);
      await expect(getDeposit('dep-999', 'user-1')).rejects.toThrow('Deposit not found');
    });
  });
});
