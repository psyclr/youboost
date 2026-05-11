import { createReferralsRepository } from '../referrals.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createFakePrisma(): {
  prisma: PrismaClient;
  mocks: {
    userFindUnique: jest.Mock;
    userUpdate: jest.Mock;
    userCount: jest.Mock;
    bonusCreate: jest.Mock;
    bonusFindMany: jest.Mock;
    bonusFindFirst: jest.Mock;
    bonusUpdate: jest.Mock;
  };
} {
  const userFindUnique = jest.fn();
  const userUpdate = jest.fn();
  const userCount = jest.fn();
  const bonusCreate = jest.fn();
  const bonusFindMany = jest.fn();
  const bonusFindFirst = jest.fn();
  const bonusUpdate = jest.fn();
  const prisma = {
    user: { findUnique: userFindUnique, update: userUpdate, count: userCount },
    referralBonus: {
      create: bonusCreate,
      findMany: bonusFindMany,
      findFirst: bonusFindFirst,
      update: bonusUpdate,
    },
  } as unknown as PrismaClient;
  return {
    prisma,
    mocks: {
      userFindUnique,
      userUpdate,
      userCount,
      bonusCreate,
      bonusFindMany,
      bonusFindFirst,
      bonusUpdate,
    },
  };
}

describe('Referrals Repository', () => {
  describe('generateReferralCode', () => {
    it('generates a unique code and updates user on first attempt', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue(null);
      mocks.userUpdate.mockResolvedValue({ id: 'user-1' });
      const repo = createReferralsRepository(prisma);

      const code = await repo.generateReferralCode('user-1');

      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      expect(code.length).toBeLessThanOrEqual(8);
      expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { referralCode: code } });
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { referralCode: code },
      });
    });

    it('retries when generated code collides with an existing one', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique
        .mockResolvedValueOnce({ id: 'other' }) // collision
        .mockResolvedValueOnce(null); // unique on retry
      mocks.userUpdate.mockResolvedValue({ id: 'user-1' });
      const repo = createReferralsRepository(prisma);

      const code = await repo.generateReferralCode('user-1');

      expect(typeof code).toBe('string');
      expect(mocks.userFindUnique).toHaveBeenCalledTimes(2);
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { referralCode: code },
      });
    });

    it('throws when unable to find unique code after 10 attempts', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue({ id: 'collision' });
      const repo = createReferralsRepository(prisma);

      await expect(repo.generateReferralCode('user-1')).rejects.toThrow(
        'Failed to generate unique referral code',
      );
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findUserByReferralCode', () => {
    it('returns user when referral code matches', async () => {
      const { prisma, mocks } = createFakePrisma();
      const user = { id: 'user-1', username: 'alice', referralCode: 'ABC123' };
      mocks.userFindUnique.mockResolvedValue(user);
      const repo = createReferralsRepository(prisma);

      const result = await repo.findUserByReferralCode('ABC123');

      expect(result).toEqual(user);
      expect(mocks.userFindUnique).toHaveBeenCalledWith({
        where: { referralCode: 'ABC123' },
        select: { id: true, username: true, referralCode: true },
      });
    });

    it('returns null when no user has that referral code', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue(null);
      const repo = createReferralsRepository(prisma);

      const result = await repo.findUserByReferralCode('nope');

      expect(result).toBeNull();
    });
  });

  describe('getUserReferralCode', () => {
    it('returns code when user has one', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue({ referralCode: 'CODE42' });
      const repo = createReferralsRepository(prisma);

      const code = await repo.getUserReferralCode('user-1');

      expect(code).toBe('CODE42');
      expect(mocks.userFindUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { referralCode: true },
      });
    });

    it('returns null when user has no referral code', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue({ referralCode: null });
      const repo = createReferralsRepository(prisma);

      const code = await repo.getUserReferralCode('user-1');

      expect(code).toBeNull();
    });

    it('returns null when user not found', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userFindUnique.mockResolvedValue(null);
      const repo = createReferralsRepository(prisma);

      const code = await repo.getUserReferralCode('user-1');

      expect(code).toBeNull();
    });
  });

  describe('setReferredBy', () => {
    it('updates user referredById', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userUpdate.mockResolvedValue({ id: 'user-1' });
      const repo = createReferralsRepository(prisma);

      await repo.setReferredBy('user-1', 'referrer-99');

      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { referredById: 'referrer-99' },
      });
    });
  });

  describe('createReferralBonus', () => {
    it('creates a PENDING bonus with given amount', async () => {
      const { prisma, mocks } = createFakePrisma();
      const bonus = {
        id: 'bonus-1',
        referrerId: 'referrer-1',
        referredId: 'referred-1',
        amount: 5,
        status: 'PENDING',
        createdAt: new Date(),
      };
      mocks.bonusCreate.mockResolvedValue(bonus);
      const repo = createReferralsRepository(prisma);

      const result = await repo.createReferralBonus('referrer-1', 'referred-1', 5);

      expect(result).toEqual(bonus);
      expect(mocks.bonusCreate).toHaveBeenCalledWith({
        data: {
          referrerId: 'referrer-1',
          referredId: 'referred-1',
          amount: 5,
          status: 'PENDING',
        },
      });
    });
  });

  describe('getReferralStats', () => {
    it('aggregates counts and sums credited bonuses', async () => {
      const { prisma, mocks } = createFakePrisma();
      const bonuses = [
        {
          id: 'b1',
          amount: 10,
          status: 'CREDITED',
          createdAt: new Date('2024-01-01'),
          referred: { username: 'bob' },
        },
        {
          id: 'b2',
          amount: 5,
          status: 'PENDING',
          createdAt: new Date('2024-02-01'),
          referred: { username: 'carol' },
        },
        {
          id: 'b3',
          amount: 2.5,
          status: 'CREDITED',
          createdAt: new Date('2024-03-01'),
          referred: { username: 'dave' },
        },
      ];
      mocks.userCount.mockResolvedValue(3);
      mocks.bonusFindMany.mockResolvedValue(bonuses);
      const repo = createReferralsRepository(prisma);

      const result = await repo.getReferralStats('user-1');

      expect(result.totalReferred).toBe(3);
      expect(result.totalEarned).toBe(12.5);
      expect(result.bonuses).toEqual([
        {
          id: 'b1',
          referredUsername: 'bob',
          amount: 10,
          status: 'CREDITED',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'b2',
          referredUsername: 'carol',
          amount: 5,
          status: 'PENDING',
          createdAt: new Date('2024-02-01'),
        },
        {
          id: 'b3',
          referredUsername: 'dave',
          amount: 2.5,
          status: 'CREDITED',
          createdAt: new Date('2024-03-01'),
        },
      ]);
      expect(mocks.userCount).toHaveBeenCalledWith({ where: { referredById: 'user-1' } });
      expect(mocks.bonusFindMany).toHaveBeenCalledWith({
        where: { referrerId: 'user-1' },
        include: { referred: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('handles zero referrals and no bonuses', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.userCount.mockResolvedValue(0);
      mocks.bonusFindMany.mockResolvedValue([]);
      const repo = createReferralsRepository(prisma);

      const result = await repo.getReferralStats('user-1');

      expect(result.totalReferred).toBe(0);
      expect(result.totalEarned).toBe(0);
      expect(result.bonuses).toEqual([]);
    });
  });

  describe('findPendingBonusByReferredId', () => {
    it('returns pending bonus when one exists', async () => {
      const { prisma, mocks } = createFakePrisma();
      const bonus = { id: 'b1', status: 'PENDING' };
      mocks.bonusFindFirst.mockResolvedValue(bonus);
      const repo = createReferralsRepository(prisma);

      const result = await repo.findPendingBonusByReferredId('referred-1');

      expect(result).toEqual(bonus);
      expect(mocks.bonusFindFirst).toHaveBeenCalledWith({
        where: { referredId: 'referred-1', status: 'PENDING' },
      });
    });

    it('returns null when no pending bonus exists', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.bonusFindFirst.mockResolvedValue(null);
      const repo = createReferralsRepository(prisma);

      const result = await repo.findPendingBonusByReferredId('referred-1');

      expect(result).toBeNull();
    });
  });

  describe('creditBonus', () => {
    it('updates bonus status to CREDITED', async () => {
      const { prisma, mocks } = createFakePrisma();
      mocks.bonusUpdate.mockResolvedValue({ id: 'b1', status: 'CREDITED' });
      const repo = createReferralsRepository(prisma);

      await repo.creditBonus('b1');

      expect(mocks.bonusUpdate).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: 'CREDITED' },
      });
    });
  });
});
