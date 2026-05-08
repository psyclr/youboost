import { createReferralsService } from '../referrals.service';
import {
  createFakeReferralsRepository,
  createFakeWalletOps,
  createFakePrisma,
  silentLogger,
} from './fakes';
import type { ReferralBonus } from '../../../generated/prisma';

function buildService(opts?: {
  repo?: ReturnType<typeof createFakeReferralsRepository>;
  walletOps?: ReturnType<typeof createFakeWalletOps>;
  prismaHelper?: ReturnType<typeof createFakePrisma>;
}): {
  service: ReturnType<typeof createReferralsService>;
  repo: ReturnType<typeof createFakeReferralsRepository>;
  walletOps: ReturnType<typeof createFakeWalletOps>;
  prismaHelper: ReturnType<typeof createFakePrisma>;
} {
  const repo = opts?.repo ?? createFakeReferralsRepository();
  const walletOps = opts?.walletOps ?? createFakeWalletOps();
  const prismaHelper = opts?.prismaHelper ?? createFakePrisma();
  const service = createReferralsService({
    referralsRepo: repo,
    walletOps,
    prisma: prismaHelper.prisma,
    logger: silentLogger,
  });
  return { service, repo, walletOps, prismaHelper };
}

describe('Referrals Service', () => {
  describe('getReferralCode', () => {
    it('returns existing code if user already has one', async () => {
      const repo = createFakeReferralsRepository({
        codesByUser: { 'user-1': 'ABC12345' },
      });
      const { service } = buildService({ repo });

      const result = await service.getReferralCode('user-1');

      expect(result).toBe('ABC12345');
      expect(repo.calls.generateReferralCode).toHaveLength(0);
    });

    it('generates new code if user has none', async () => {
      const repo = createFakeReferralsRepository({ nextGeneratedCode: 'NEW12345' });
      const { service } = buildService({ repo });

      const result = await service.getReferralCode('user-1');

      expect(result).toBe('NEW12345');
      expect(repo.calls.generateReferralCode).toEqual(['user-1']);
    });
  });

  describe('getReferralStats', () => {
    it('returns stats with referral code', async () => {
      const repo = createFakeReferralsRepository({
        codesByUser: { 'user-1': 'MYCODE' },
        statsByUser: {
          'user-1': {
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
          },
        },
      });
      const { service } = buildService({ repo });

      const result = await service.getReferralStats('user-1');

      expect(result.referralCode).toBe('MYCODE');
      expect(result.totalReferred).toBe(5);
      expect(result.totalEarned).toBe(5.0);
      expect(result.bonuses).toHaveLength(1);
      expect(result.bonuses[0]?.referredUsername).toBe('jane');
    });
  });

  describe('applyReferral', () => {
    it('applies referral for valid code', async () => {
      const repo = createFakeReferralsRepository({
        userByCode: {
          CODE123: { id: 'referrer-1', username: 'john', referralCode: 'CODE123' },
        },
      });
      const { service } = buildService({ repo });

      await service.applyReferral('user-new', 'CODE123');

      expect(repo.calls.setReferredBy).toEqual([{ userId: 'user-new', referrerId: 'referrer-1' }]);
      expect(repo.calls.createReferralBonus).toEqual([
        { referrerId: 'referrer-1', referredId: 'user-new', amount: 1.0 },
      ]);
    });

    it('throws NotFoundError for invalid code', async () => {
      const { service } = buildService();

      await expect(service.applyReferral('user-new', 'INVALID')).rejects.toThrow(
        'Invalid referral code',
      );
    });

    it('throws ValidationError for self-referral', async () => {
      const repo = createFakeReferralsRepository({
        userByCode: {
          MYCODE: { id: 'user-1', username: 'john', referralCode: 'MYCODE' },
        },
      });
      const { service } = buildService({ repo });

      await expect(service.applyReferral('user-1', 'MYCODE')).rejects.toThrow(
        'Cannot refer yourself',
      );
    });
  });

  describe('creditPendingBonuses', () => {
    it('credits bonus to referrer wallet', async () => {
      const pendingBonus = {
        id: 'bonus-1',
        referrerId: 'referrer-1',
        referredId: 'referred-1',
        amount: 1.0,
        status: 'PENDING',
        createdAt: new Date('2024-01-01'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as ReferralBonus;

      const repo = createFakeReferralsRepository({
        pendingBonusByReferred: { 'referred-1': pendingBonus },
      });
      const walletOps = createFakeWalletOps({
        walletsByUser: {
          'referrer-1': { id: 'wallet-1', balance: 10.0, holdAmount: 0 },
        },
      });
      const { service, prismaHelper } = buildService({ repo, walletOps });

      await service.creditPendingBonuses('referred-1');

      expect(prismaHelper.calls.transactions).toBe(1);
      expect(walletOps.calls.updateBalance).toEqual([
        { walletId: 'wallet-1', newBalance: 11.0, newHold: 0 },
      ]);
      expect(walletOps.calls.createLedgerEntry).toHaveLength(1);
      expect(walletOps.calls.createLedgerEntry[0]).toMatchObject({
        userId: 'referrer-1',
        walletId: 'wallet-1',
        type: 'DEPOSIT',
        amount: 1.0,
        balanceBefore: 10.0,
        balanceAfter: 11.0,
        referenceType: 'referral',
        referenceId: 'bonus-1',
      });
      expect(repo.calls.creditBonus).toEqual(['bonus-1']);
    });

    it('does nothing when no pending bonus exists', async () => {
      const repo = createFakeReferralsRepository();
      const { service, prismaHelper } = buildService({ repo });

      await service.creditPendingBonuses('referred-1');

      expect(prismaHelper.calls.transactions).toBe(0);
      expect(repo.calls.creditBonus).toHaveLength(0);
    });
  });
});
