import type { PrismaClient, ReferralBonus } from '../../../generated/prisma';
import type { ReferralsRepository } from '../referrals.repository';
import type { ReferralsWalletPort } from '../ports/wallet.port';

export type FakeReferralsRepository = ReferralsRepository & {
  calls: {
    generateReferralCode: string[];
    findUserByReferralCode: string[];
    getUserReferralCode: string[];
    setReferredBy: Array<{ userId: string; referrerId: string }>;
    createReferralBonus: Array<{ referrerId: string; referredId: string; amount: number }>;
    getReferralStats: string[];
    findPendingBonusByReferredId: string[];
    creditBonus: string[];
  };
};

export interface FakeReferralsRepositorySeed {
  codesByUser?: Record<string, string | null>;
  userByCode?: Record<string, { id: string; username: string; referralCode: string | null }>;
  statsByUser?: Record<
    string,
    {
      totalReferred: number;
      totalEarned: number;
      bonuses: Array<{
        id: string;
        referredUsername: string;
        amount: number;
        status: string;
        createdAt: Date;
      }>;
    }
  >;
  pendingBonusByReferred?: Record<string, ReferralBonus | null>;
  /** Next generated referral code (for generateReferralCode). */
  nextGeneratedCode?: string;
}

export function createFakeReferralsRepository(
  seed: FakeReferralsRepositorySeed = {},
): FakeReferralsRepository {
  const codesByUser = new Map<string, string | null>(Object.entries(seed.codesByUser ?? {}));
  const userByCode = new Map(Object.entries(seed.userByCode ?? {}));
  const statsByUser = new Map(Object.entries(seed.statsByUser ?? {}));
  const pendingBonusByReferred = new Map<string, ReferralBonus | null>(
    Object.entries(seed.pendingBonusByReferred ?? {}),
  );

  const calls: FakeReferralsRepository['calls'] = {
    generateReferralCode: [],
    findUserByReferralCode: [],
    getUserReferralCode: [],
    setReferredBy: [],
    createReferralBonus: [],
    getReferralStats: [],
    findPendingBonusByReferredId: [],
    creditBonus: [],
  };

  let generatedCounter = 0;

  return {
    async generateReferralCode(userId) {
      calls.generateReferralCode.push(userId);
      const code = seed.nextGeneratedCode ?? `GEN${++generatedCounter}`;
      codesByUser.set(userId, code);
      return code;
    },
    async findUserByReferralCode(code) {
      calls.findUserByReferralCode.push(code);
      return userByCode.get(code) ?? null;
    },
    async getUserReferralCode(userId) {
      calls.getUserReferralCode.push(userId);
      return codesByUser.get(userId) ?? null;
    },
    async setReferredBy(userId, referrerId) {
      calls.setReferredBy.push({ userId, referrerId });
    },
    async createReferralBonus(referrerId, referredId, amount) {
      calls.createReferralBonus.push({ referrerId, referredId, amount });
      return {
        id: `bonus-${calls.createReferralBonus.length}`,
        referrerId,
        referredId,
        amount,
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    },
    async getReferralStats(userId) {
      calls.getReferralStats.push(userId);
      return (
        statsByUser.get(userId) ?? {
          totalReferred: 0,
          totalEarned: 0,
          bonuses: [],
        }
      );
    },
    async findPendingBonusByReferredId(referredId) {
      calls.findPendingBonusByReferredId.push(referredId);
      return pendingBonusByReferred.get(referredId) ?? null;
    },
    async creditBonus(bonusId) {
      calls.creditBonus.push(bonusId);
    },
    calls,
  };
}

export type FakeWalletOps = ReferralsWalletPort & {
  calls: {
    getOrCreateWallet: string[];
    updateBalance: Array<{
      walletId: string;
      newBalance: number;
      newHold: number;
    }>;
    createLedgerEntry: Array<{
      userId: string;
      walletId: string;
      type: string;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      referenceType: string;
      referenceId: string;
      description: string;
    }>;
  };
};

export interface FakeWalletOpsSeed {
  walletsByUser?: Record<string, { id: string; balance: number; holdAmount: number }>;
}

export function createFakeWalletOps(seed: FakeWalletOpsSeed = {}): FakeWalletOps {
  const walletsByUser = new Map(Object.entries(seed.walletsByUser ?? {}));

  const calls: FakeWalletOps['calls'] = {
    getOrCreateWallet: [],
    updateBalance: [],
    createLedgerEntry: [],
  };

  return {
    async getOrCreateWallet(userId) {
      calls.getOrCreateWallet.push(userId);
      const existing = walletsByUser.get(userId);
      if (existing) return existing;
      const created = {
        id: `wallet-${userId}`,
        balance: 0,
        holdAmount: 0,
      };
      walletsByUser.set(userId, created);
      return created;
    },
    async updateBalance(args) {
      calls.updateBalance.push({
        walletId: args.walletId,
        newBalance: args.newBalance,
        newHold: args.newHold,
      });
    },
    async createLedgerEntry(data) {
      calls.createLedgerEntry.push(data);
    },
    calls,
  };
}

/**
 * Minimal Prisma fake: $transaction immediately invokes the callback with an
 * empty tx sentinel. Tests that care about tx identity can assert on the
 * reference passed into wallet port calls.
 */
export function createFakePrisma(): {
  prisma: PrismaClient;
  calls: { transactions: number };
} {
  const calls = { transactions: 0 };
  const txSentinel = { __fakeTx: true };
  const prisma = {
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      calls.transactions += 1;
      return fn(txSentinel);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as PrismaClient;
  return { prisma, calls };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
