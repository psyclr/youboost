import { createLedgerEntry, findLedgerById, findLedgerEntries } from '../ledger.repository';

const mockLedger = {
  id: 'ledger-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  type: 'DEPOSIT',
  amount: { toNumber: (): number => 100 },
  balanceBefore: { toNumber: (): number => 0 },
  balanceAfter: { toNumber: (): number => 100 },
  referenceType: null,
  referenceId: null,
  description: 'Test deposit',
  metadata: null,
  createdAt: new Date(),
};

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    ledger: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
    },
  }),
}));

describe('Ledger Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLedgerEntry', () => {
    const data = {
      userId: 'user-1',
      walletId: 'wallet-1',
      type: 'DEPOSIT' as const,
      amount: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      description: 'Test deposit',
    };

    it('should create a ledger entry', async () => {
      mockCreate.mockResolvedValue(mockLedger);
      const result = await createLedgerEntry(data);
      expect(result).toEqual(mockLedger);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          walletId: 'wallet-1',
          type: 'DEPOSIT',
          amount: 100,
          description: 'Test deposit',
        }),
      });
    });

    it('should use transaction client if provided', async () => {
      const txCreate = jest.fn().mockResolvedValue(mockLedger);
      const txClient = { ledger: { create: txCreate } };
      await createLedgerEntry(data, txClient as never);
      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', type: 'DEPOSIT' }),
      });
    });
  });

  describe('findLedgerById', () => {
    it('should find ledger by id scoped to userId', async () => {
      mockFindFirst.mockResolvedValue(mockLedger);
      const result = await findLedgerById('ledger-1', 'user-1');
      expect(result).toEqual(mockLedger);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'ledger-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await findLedgerById('ledger-2', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('findLedgerEntries', () => {
    it('should return paginated entries', async () => {
      mockFindMany.mockResolvedValue([mockLedger]);
      mockCount.mockResolvedValue(1);

      const result = await findLedgerEntries('user-1', { page: 1, limit: 20 });
      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply type filter', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findLedgerEntries('user-1', { page: 1, limit: 10, type: 'HOLD' });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', type: 'HOLD' },
        }),
      );
    });

    it('should calculate correct skip for page 2', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(25);

      await findLedgerEntries('user-1', { page: 2, limit: 10 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });
  });
});
