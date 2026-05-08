export type { ReferralsService } from './referrals.service';
export { createReferralsService } from './referrals.service';
export type { ReferralsRepository } from './referrals.repository';
export { createReferralsRepository } from './referrals.repository';
export type { ReferralsWalletPort } from './ports/wallet.port';

// Transitional shims for unconverted callers (auth module). Delete when auth
// converts in phase F12 or billing in F14.
import { getPrisma } from '../../shared/database';
import { createServiceLogger } from '../../shared/utils/logger';
import { walletRepo, ledgerRepo } from '../billing';
import type { LedgerType } from '../../generated/prisma';
import type { ReferralsService } from './referrals.service';
import type { ReferralsWalletPort } from './ports/wallet.port';
import { createReferralsRepository as _createRepo } from './referrals.repository';
import { createReferralsService as _createService } from './referrals.service';

let _service: ReferralsService | null = null;

function getService(): ReferralsService {
  if (!_service) {
    const prisma = getPrisma();
    const walletOps: ReferralsWalletPort = {
      getOrCreateWallet: (userId) => walletRepo.getOrCreateWallet(userId),
      updateBalance: async (args) => {
        await walletRepo.updateBalance({
          walletId: args.walletId,
          newBalance: args.newBalance,
          newHold: args.newHold,
          tx: args.tx,
        });
      },
      createLedgerEntry: async (data, tx) => {
        await ledgerRepo.createLedgerEntry(
          {
            userId: data.userId,
            walletId: data.walletId,
            // Port uses `string` for type; billing expects LedgerType enum.
            // The service only ever passes 'DEPOSIT' which is a valid member.
            type: data.type as LedgerType,
            amount: data.amount,
            balanceBefore: data.balanceBefore,
            balanceAfter: data.balanceAfter,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            description: data.description,
          },
          tx,
        );
      },
    };
    _service = _createService({
      referralsRepo: _createRepo(prisma),
      walletOps,
      prisma,
      logger: createServiceLogger('referrals'),
    });
  }
  return _service;
}

export async function applyReferral(referredUserId: string, referralCode: string): Promise<void> {
  return getService().applyReferral(referredUserId, referralCode);
}
