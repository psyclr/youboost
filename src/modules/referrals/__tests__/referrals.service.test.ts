import {
  getReferralCode,
  getReferralStats,
  applyReferral,
  creditPendingBonuses,
} from '../referrals.service';

const mockGetUserReferralCode = jest.fn();
const mockGenerateReferralCode = jest.fn();
const mockFindUserByReferralCode = jest.fn();
const mockSetReferredBy = jest.fn();
const mockCreateReferralBonus = jest.fn();
const mockGetReferralStatsRepo = jest.fn();
const mockFindPendingBonusByReferredId = jest.fn();
const mockCreditBonus = jest.fn();

jest.mock('../referrals.repository', () => ({
  getUserReferralCode: (...args: unknown[]): unknown => mockGetUserReferralCode(...args),
  generateReferralCode: (...args: unknown[]): unknown => mockGenerateReferralCode(...args),
  findUserByReferralCode: (...args: unknown[]): unknown => mockFindUserByReferralCode(...args),
  setReferredBy: (...args: unknown[]): unknown => mockSetReferredBy(...args),
  createReferralBonus: (...args: unknown[]): unknown => mockCreateReferralBonus(...args),
  getReferralStats: (...args: unknown[]): unknown => mockGetReferralStatsRepo(...args),
  findPendingBonusByReferredId: (...args: unknown[]): unknown =>
    mockFindPendingBonusByReferredId(...args),
  creditBonus: (...args: unknown[]): unknown => mockCreditBonus(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
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

const mockTransaction = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: () => ({
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  }),
}));

describe('Referrals Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn) => fn({}));
  });

  describe('getReferralCode', () => {
    it('should return existing code if user already has one', async () => {
      mockGetUserReferralCode.mockResolvedValue('ABC12345');

      const result = await getReferralCode('user-1');

      expect(result).toBe('ABC12345');
      expect(mockGenerateReferralCode).not.toHaveBeenCalled();
    });

    it('should generate new code if user has none', async () => {
      mockGetUserReferralCode.mockResolvedValue(null);
      mockGenerateReferralCode.mockResolvedValue('NEW12345');

      const result = await getReferralCode('user-1');

      expect(result).toBe('NEW12345');
      expect(mockGenerateReferralCode).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getReferralStats', () => {
    it('should return stats with referral code', async () => {
      mockGetUserReferralCode.mockResolvedValue('MYCODE');
      mockGetReferralStatsRepo.mockResolvedValue({
        totalReferred: 5,
        totalEarned: 5.0,
        bonuses: [
          {
            id: 'bonus-1',
            referredUsername: 'jane',
            amount: 1.0,
            status: 'CREDITED',
            createdAt: new Date('2024-01-15'),
          },
        ],
      });

      const result = await getReferralStats('user-1');

      expect(result.referralCode).toBe('MYCODE');
      expect(result.totalReferred).toBe(5);
      expect(result.totalEarned).toBe(5.0);
      expect(result.bonuses).toHaveLength(1);
      expect(result.bonuses[0]?.referredUsername).toBe('jane');
    });
  });

  describe('applyReferral', () => {
    it('should apply referral for valid code', async () => {
      mockFindUserByReferralCode.mockResolvedValue({
        id: 'referrer-1',
        username: 'john',
        referralCode: 'CODE123',
      });

      await applyReferral('user-new', 'CODE123');

      expect(mockSetReferredBy).toHaveBeenCalledWith('user-new', 'referrer-1');
      expect(mockCreateReferralBonus).toHaveBeenCalledWith('referrer-1', 'user-new', 1.0);
    });

    it('should throw NotFoundError for invalid code', async () => {
      mockFindUserByReferralCode.mockResolvedValue(null);

      await expect(applyReferral('user-new', 'INVALID')).rejects.toThrow('Invalid referral code');
    });

    it('should throw ValidationError for self-referral', async () => {
      mockFindUserByReferralCode.mockResolvedValue({
        id: 'user-1',
        username: 'john',
        referralCode: 'MYCODE',
      });

      await expect(applyReferral('user-1', 'MYCODE')).rejects.toThrow('Cannot refer yourself');
    });
  });

  describe('creditPendingBonuses', () => {
    it('should credit bonus to referrer wallet', async () => {
      mockFindPendingBonusByReferredId.mockResolvedValue({
        id: 'bonus-1',
        referrerId: 'referrer-1',
        referredId: 'referred-1',
        amount: 1.0,
        status: 'PENDING',
      });

      mockGetOrCreateWallet.mockResolvedValue({
        id: 'wallet-1',
        balance: 10.0,
        holdAmount: 0,
      });

      await creditPendingBonuses('referred-1');

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockUpdateBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId: 'wallet-1',
          newBalance: 11.0,
          newHold: 0,
        }),
      );
      expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'referrer-1',
          type: 'DEPOSIT',
          amount: 1.0,
          balanceBefore: 10.0,
          balanceAfter: 11.0,
          referenceType: 'referral',
          referenceId: 'bonus-1',
        }),
        expect.anything(),
      );
      expect(mockCreditBonus).toHaveBeenCalledWith('bonus-1');
    });

    it('should do nothing when no pending bonus exists', async () => {
      mockFindPendingBonusByReferredId.mockResolvedValue(null);

      await creditPendingBonuses('referred-1');

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockCreditBonus).not.toHaveBeenCalled();
    });
  });
});
