import { getPrisma } from '../../shared/database';
import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { getConfig } from '../../shared/config';
import * as walletRepo from './wallet.repository';
import * as ledgerRepo from './ledger.repository';
import * as depositRepo from './deposit.repository';
import type { DepositRecord } from './deposit.types';

const log = createServiceLogger('deposit-lifecycle');

/**
 * Validate deposit amount against configured min/max, ensure a wallet
 * exists, and create a PENDING deposit row. Shared by payment providers
 * (Stripe, Cryptomus, ...) so min/max and expiry stay centralized.
 */
export async function prepareDepositCheckout(
  userId: string,
  amount: number,
): Promise<DepositRecord> {
  const { billing } = getConfig();
  if (amount < billing.minDeposit) {
    throw new ValidationError(
      `Minimum deposit is $${billing.minDeposit.toFixed(2)}`,
      'MIN_DEPOSIT',
    );
  }
  if (amount > billing.maxDeposit) {
    throw new ValidationError(
      `Maximum deposit is $${billing.maxDeposit.toFixed(2)}`,
      'MAX_DEPOSIT',
    );
  }

  await walletRepo.getOrCreateWallet(userId);

  return depositRepo.createDeposit({
    userId,
    amount,
    cryptoAmount: 0,
    cryptoCurrency: '',
    paymentAddress: '',
    expiresAt: new Date(Date.now() + billing.depositExpiryMs),
  });
}

/**
 * Atomic deposit confirm: fresh fetch inside tx guards against double
 * credit under concurrent webhook retries. Both Stripe and Cryptomus
 * webhooks call this after verifying their signatures.
 */
export async function confirmDepositTransaction(
  depositId: string,
  userId: string,
  providerLabel: string,
): Promise<void> {
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const deposit = await depositRepo.findDepositById(depositId, userId, tx);
    if (!deposit) {
      log.warn({ depositId, userId, providerLabel }, 'Deposit not found during confirm');
      return null;
    }
    if (deposit.status !== 'PENDING') {
      log.debug({ depositId, status: deposit.status, providerLabel }, 'Deposit already processed');
      return null;
    }

    const amount = Number(deposit.amount);
    const wallet = await walletRepo.getOrCreateWallet(userId, 'USD', tx);
    const balanceBefore = Number(wallet.balance);
    const newBalance = balanceBefore + amount;

    await walletRepo.updateBalance({
      walletId: wallet.id,
      newBalance,
      newHold: Number(wallet.holdAmount),
      tx,
    });

    const entry = await ledgerRepo.createLedgerEntry(
      {
        userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        referenceType: 'deposit',
        referenceId: depositId,
        description: `${providerLabel} deposit $${amount.toFixed(2)}`,
      },
      tx,
    );

    await depositRepo.updateDepositStatus(
      depositId,
      {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        ledgerEntryId: entry.id,
      },
      tx,
    );

    return { amount };
  });

  if (result) {
    log.info(
      { userId, depositId, amount: result.amount, providerLabel },
      `${providerLabel} deposit confirmed`,
    );
  }
}

/**
 * Mark a PENDING deposit as FAILED inside a transaction. Idempotent.
 * Used when a provider reports unrecoverable failure (Cryptomus 'fail',
 * 'cancel', 'wrong_amount', etc.).
 */
export async function failDepositTransaction(
  depositId: string,
  providerLabel: string,
  reason: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const fresh = await depositRepo.findDepositById(depositId, undefined, tx);
    if (fresh?.status !== 'PENDING') return;
    await depositRepo.updateDepositStatus(
      depositId,
      {
        status: 'FAILED',
        confirmedAt: null,
        ledgerEntryId: null,
      },
      tx,
    );
    log.info({ depositId, providerLabel, reason }, `${providerLabel} deposit marked FAILED`);
  });
}
