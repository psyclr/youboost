import {
  createDeposit,
  findDepositById,
  findDepositsByUserId,
  updateDepositStatus,
} from '../deposit.repository';

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: (): unknown => ({
    deposit: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

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

describe('Deposit Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDeposit', () => {
    it('should create deposit with PENDING status', async () => {
      mockCreate.mockResolvedValue(mockDeposit);

      const result = await createDeposit({
        userId: 'user-1',
        amount: 100,
        cryptoAmount: 100,
        cryptoCurrency: 'USDT',
        paymentAddress: '0xAddr',
        expiresAt: new Date(),
      });

      expect(result.id).toBe('dep-1');
      expect(mockCreate).toHaveBeenCalledWith({
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
      mockFindFirst.mockResolvedValue(mockDeposit);

      const result = await findDepositById('dep-1');

      expect(result?.id).toBe('dep-1');
    });

    it('should filter by userId when provided', async () => {
      mockFindFirst.mockResolvedValue(mockDeposit);

      await findDepositById('dep-1', 'user-1');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1', userId: 'user-1' },
      });
    });

    it('should not include userId when not provided', async () => {
      mockFindFirst.mockResolvedValue(mockDeposit);

      await findDepositById('dep-1');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findDepositById('dep-999');

      expect(result).toBeNull();
    });
  });

  describe('findDepositsByUserId', () => {
    it('should return paginated deposits', async () => {
      mockFindMany.mockResolvedValue([mockDeposit]);
      mockCount.mockResolvedValue(1);

      const result = await findDepositsByUserId('user-1', { page: 1, limit: 20 });

      expect(result.deposits).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findDepositsByUserId('user-1', { status: 'CONFIRMED', page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'CONFIRMED' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findDepositsByUserId('user-1', { page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findDepositsByUserId('user-1', { page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('updateDepositStatus', () => {
    it('should update deposit status', async () => {
      mockUpdate.mockResolvedValue({ ...mockDeposit, status: 'CONFIRMED' });

      const result = await updateDepositStatus('dep-1', {
        status: 'CONFIRMED',
        txHash: '0xTxHash',
        confirmedAt: new Date(),
        ledgerEntryId: 'ledger-1',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          txHash: '0xTxHash',
        }),
      });
    });

    it('should update to EXPIRED without txHash', async () => {
      mockUpdate.mockResolvedValue({ ...mockDeposit, status: 'EXPIRED' });

      await updateDepositStatus('dep-1', { status: 'EXPIRED' });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
