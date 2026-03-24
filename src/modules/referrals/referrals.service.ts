import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import * as referralRepo from './referrals.repository';
import * as walletRepo from '../billing/wallet.repository';
import * as ledgerRepo from '../billing/ledger.repository';
import { getPrisma } from '../../shared/database';
import type { ReferralStats } from './referrals.types';

const log = createServiceLogger('referrals');

const REFERRAL_BONUS_AMOUNT = 1; // $1.00 default

export async function getReferralCode(userId: string): Promise<string> {
  const existing = await referralRepo.getUserReferralCode(userId);
  if (existing) return existing;

  const code = await referralRepo.generateReferralCode(userId);
  log.info({ userId, code }, 'Referral code generated');
  return code;
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getReferralCode(userId);
  const stats = await referralRepo.getReferralStats(userId);

  return {
    referralCode: code,
    totalReferred: stats.totalReferred,
    totalEarned: stats.totalEarned,
    bonuses: stats.bonuses,
  };
}

export async function applyReferral(referredUserId: string, referralCode: string): Promise<void> {
  const referrer = await referralRepo.findUserByReferralCode(referralCode);
  if (!referrer) {
    throw new NotFoundError('Invalid referral code', 'REFERRAL_CODE_NOT_FOUND');
  }

  if (referrer.id === referredUserId) {
    throw new ValidationError('Cannot refer yourself', 'SELF_REFERRAL');
  }

  await referralRepo.setReferredBy(referredUserId, referrer.id);
  await referralRepo.createReferralBonus(referrer.id, referredUserId, REFERRAL_BONUS_AMOUNT);

  log.info({ referrerId: referrer.id, referredUserId, code: referralCode }, 'Referral applied');
}

export async function creditPendingBonuses(referredUserId: string): Promise<void> {
  const bonus = await referralRepo.findPendingBonusByReferredId(referredUserId);
  if (!bonus) return;

  const prisma = getPrisma();
  const amount = Number(bonus.amount);

  await prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.getOrCreateWallet(bonus.referrerId);
    const balance = Number(wallet.balance);
    const hold = Number(wallet.holdAmount);
    const newBalance = balance + amount;

    await walletRepo.updateBalance({
      walletId: wallet.id,
      newBalance,
      newHold: hold,
      tx,
    });

    await ledgerRepo.createLedgerEntry(
      {
        userId: bonus.referrerId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        balanceBefore: balance,
        balanceAfter: newBalance,
        referenceType: 'referral',
        referenceId: bonus.id,
        description: `Referral bonus: $${amount.toFixed(2)}`,
      },
      tx,
    );
  });

  await referralRepo.creditBonus(bonus.id);

  log.info(
    { referrerId: bonus.referrerId, referredUserId, bonusId: bonus.id, amount },
    'Referral bonus credited',
  );
}
