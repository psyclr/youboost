import { getPrisma } from '../../shared/database';
import crypto from 'node:crypto';
import type { PrismaClient, ReferralBonus } from '../../generated/prisma';

export interface ReferralsRepository {
  generateReferralCode(userId: string): Promise<string>;
  findUserByReferralCode(
    code: string,
  ): Promise<{ id: string; username: string; referralCode: string | null } | null>;
  getUserReferralCode(userId: string): Promise<string | null>;
  setReferredBy(userId: string, referrerId: string): Promise<void>;
  createReferralBonus(
    referrerId: string,
    referredId: string,
    amount: number,
  ): Promise<ReferralBonus>;
  getReferralStats(userId: string): Promise<{
    totalReferred: number;
    totalEarned: number;
    bonuses: Array<{
      id: string;
      referredUsername: string;
      amount: number;
      status: string;
      createdAt: Date;
    }>;
  }>;
  findPendingBonusByReferredId(referredId: string): Promise<ReferralBonus | null>;
  creditBonus(bonusId: string): Promise<void>;
}

export function createReferralsRepository(prisma: PrismaClient): ReferralsRepository {
  async function generateReferralCode(userId: string): Promise<string> {
    // Generate a unique 8-char alphanumeric code
    let code: string;
    let attempts = 0;
    do {
      code = crypto.randomBytes(6).toString('base64url').slice(0, 8);
      const existing = await prisma.user.findUnique({ where: { referralCode: code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new Error('Failed to generate unique referral code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    return code;
  }

  async function findUserByReferralCode(
    code: string,
  ): Promise<{ id: string; username: string; referralCode: string | null } | null> {
    return prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, username: true, referralCode: true },
    });
  }

  async function getUserReferralCode(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    return user?.referralCode ?? null;
  }

  async function setReferredBy(userId: string, referrerId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { referredById: referrerId },
    });
  }

  async function createReferralBonus(
    referrerId: string,
    referredId: string,
    amount: number,
  ): Promise<ReferralBonus> {
    return prisma.referralBonus.create({
      data: {
        referrerId,
        referredId,
        amount,
        status: 'PENDING',
      },
    });
  }

  async function getReferralStats(userId: string): Promise<{
    totalReferred: number;
    totalEarned: number;
    bonuses: Array<{
      id: string;
      referredUsername: string;
      amount: number;
      status: string;
      createdAt: Date;
    }>;
  }> {
    const [totalReferred, bonuses] = await Promise.all([
      prisma.user.count({ where: { referredById: userId } }),
      prisma.referralBonus.findMany({
        where: { referrerId: userId },
        include: {
          referred: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalEarned = bonuses
      .filter((b) => b.status === 'CREDITED')
      .reduce((sum, b) => sum + Number(b.amount), 0);

    return {
      totalReferred,
      totalEarned,
      bonuses: bonuses.map((b) => ({
        id: b.id,
        referredUsername: b.referred.username,
        amount: Number(b.amount),
        status: b.status,
        createdAt: b.createdAt,
      })),
    };
  }

  async function findPendingBonusByReferredId(referredId: string): Promise<ReferralBonus | null> {
    return prisma.referralBonus.findFirst({
      where: { referredId, status: 'PENDING' },
    });
  }

  async function creditBonus(bonusId: string): Promise<void> {
    await prisma.referralBonus.update({
      where: { id: bonusId },
      data: { status: 'CREDITED' },
    });
  }

  return {
    generateReferralCode,
    findUserByReferralCode,
    getUserReferralCode,
    setReferredBy,
    createReferralBonus,
    getReferralStats,
    findPendingBonusByReferredId,
    creditBonus,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function generateReferralCode(userId: string): Promise<string> {
  return createReferralsRepository(getPrisma()).generateReferralCode(userId);
}

export async function findUserByReferralCode(
  code: string,
): Promise<{ id: string; username: string; referralCode: string | null } | null> {
  return createReferralsRepository(getPrisma()).findUserByReferralCode(code);
}

export async function getUserReferralCode(userId: string): Promise<string | null> {
  return createReferralsRepository(getPrisma()).getUserReferralCode(userId);
}

export async function setReferredBy(userId: string, referrerId: string): Promise<void> {
  return createReferralsRepository(getPrisma()).setReferredBy(userId, referrerId);
}

export async function createReferralBonus(
  referrerId: string,
  referredId: string,
  amount: number,
): Promise<ReferralBonus> {
  return createReferralsRepository(getPrisma()).createReferralBonus(referrerId, referredId, amount);
}

export async function getReferralStats(userId: string): Promise<{
  totalReferred: number;
  totalEarned: number;
  bonuses: Array<{
    id: string;
    referredUsername: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
}> {
  return createReferralsRepository(getPrisma()).getReferralStats(userId);
}

export async function findPendingBonusByReferredId(
  referredId: string,
): Promise<ReferralBonus | null> {
  return createReferralsRepository(getPrisma()).findPendingBonusByReferredId(referredId);
}

export async function creditBonus(bonusId: string): Promise<void> {
  return createReferralsRepository(getPrisma()).creditBonus(bonusId);
}
