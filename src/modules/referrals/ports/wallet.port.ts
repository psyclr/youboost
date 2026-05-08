import type { Prisma } from '../../../generated/prisma';

/**
 * Narrow cross-module port that referrals needs from billing.
 *
 * This exists so referrals doesn't depend on the full billing wallet/ledger
 * repository surface. The adapter is wired at the composition root (app.ts)
 * and in the transitional shim in referrals/index.ts.
 */
export interface ReferralsWalletPort {
  /** Returns the wallet (creating if needed) for crediting referral bonuses. */
  getOrCreateWallet(userId: string): Promise<{
    id: string;
    balance: { toNumber(): number } | number;
    holdAmount: { toNumber(): number } | number;
  }>;
  /** Writes wallet balance update inside a tx. */
  updateBalance(args: {
    walletId: string;
    newBalance: number;
    newHold: number;
    tx: Prisma.TransactionClient;
  }): Promise<void>;
  /** Creates a ledger entry for the bonus credit inside a tx. */
  createLedgerEntry(
    data: {
      userId: string;
      walletId: string;
      type: string;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      referenceType: string;
      referenceId: string;
      description: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void>;
}
