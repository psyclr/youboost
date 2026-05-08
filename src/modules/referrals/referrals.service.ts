import type { Logger } from 'pino';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { PrismaClient } from '../../generated/prisma';
import type { ReferralsRepository } from './referrals.repository';
import type { ReferralsWalletPort } from './ports/wallet.port';
import type { ReferralStats } from './referrals.types';

const REFERRAL_BONUS_AMOUNT = 1; // $1.00 default

export interface ReferralsService {
  getReferralCode(userId: string): Promise<string>;
  getReferralStats(userId: string): Promise<ReferralStats>;
  applyReferral(referredUserId: string, referralCode: string): Promise<void>;
  creditPendingBonuses(referredUserId: string): Promise<void>;
}

export interface ReferralsServiceDeps {
  referralsRepo: ReferralsRepository;
  walletOps: ReferralsWalletPort;
  logger: Logger;
  /**
   * Needed for $transaction — transitional until billing exposes a transaction
   * port. Keeping prisma here scopes the coupling so a future refactor can
   * replace it with a narrow `runInTransaction` port.
   */
  prisma: PrismaClient;
}

export function createReferralsService(deps: ReferralsServiceDeps): ReferralsService {
  const { referralsRepo, walletOps, logger, prisma } = deps;

  async function getReferralCode(userId: string): Promise<string> {
    const existing = await referralsRepo.getUserReferralCode(userId);
    if (existing) return existing;

    const code = await referralsRepo.generateReferralCode(userId);
    logger.info({ userId, code }, 'Referral code generated');
    return code;
  }

  async function getReferralStats(userId: string): Promise<ReferralStats> {
    const code = await getReferralCode(userId);
    const stats = await referralsRepo.getReferralStats(userId);

    return {
      referralCode: code,
      totalReferred: stats.totalReferred,
      totalEarned: stats.totalEarned,
      bonuses: stats.bonuses,
    };
  }

  async function applyReferral(referredUserId: string, referralCode: string): Promise<void> {
    const referrer = await referralsRepo.findUserByReferralCode(referralCode);
    if (!referrer) {
      throw new NotFoundError('Invalid referral code', 'REFERRAL_CODE_NOT_FOUND');
    }

    if (referrer.id === referredUserId) {
      throw new ValidationError('Cannot refer yourself', 'SELF_REFERRAL');
    }

    await referralsRepo.setReferredBy(referredUserId, referrer.id);
    await referralsRepo.createReferralBonus(referrer.id, referredUserId, REFERRAL_BONUS_AMOUNT);

    logger.info(
      { referrerId: referrer.id, referredUserId, code: referralCode },
      'Referral applied',
    );
  }

  async function creditPendingBonuses(referredUserId: string): Promise<void> {
    const bonus = await referralsRepo.findPendingBonusByReferredId(referredUserId);
    if (!bonus) return;

    const amount = Number(bonus.amount);

    await prisma.$transaction(async (tx) => {
      const wallet = await walletOps.getOrCreateWallet(bonus.referrerId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);
      const newBalance = balance + amount;

      await walletOps.updateBalance({
        walletId: wallet.id,
        newBalance,
        newHold: hold,
        tx,
      });

      await walletOps.createLedgerEntry(
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

    await referralsRepo.creditBonus(bonus.id);

    logger.info(
      { referrerId: bonus.referrerId, referredUserId, bonusId: bonus.id, amount },
      'Referral bonus credited',
    );
  }

  return {
    getReferralCode,
    getReferralStats,
    applyReferral,
    creditPendingBonuses,
  };
}
