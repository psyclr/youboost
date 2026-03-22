import { getPrisma } from '../../shared/database';
import crypto from 'node:crypto';
import type { ReferralBonus } from '../../generated/prisma';

export async function generateReferralCode(userId: string): Promise<string> {
  const prisma = getPrisma();

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

export async function findUserByReferralCode(
  code: string,
): Promise<{ id: string; username: string; referralCode: string | null } | null> {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, username: true, referralCode: true },
  });
}

export async function getUserReferralCode(userId: string): Promise<string | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  return user?.referralCode ?? null;
}

export async function setReferredBy(userId: string, referrerId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrerId },
  });
}

export async function createReferralBonus(
  referrerId: string,
  referredId: string,
  amount: number,
): Promise<ReferralBonus> {
  const prisma = getPrisma();
  return prisma.referralBonus.create({
    data: {
      referrerId,
      referredId,
      amount,
      status: 'PENDING',
    },
  });
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
  const prisma = getPrisma();

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

export async function findPendingBonusByReferredId(
  referredId: string,
): Promise<ReferralBonus | null> {
  const prisma = getPrisma();
  return prisma.referralBonus.findFirst({
    where: { referredId, status: 'PENDING' },
  });
}

export async function creditBonus(bonusId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.referralBonus.update({
    where: { id: bonusId },
    data: { status: 'CREDITED' },
  });
}
