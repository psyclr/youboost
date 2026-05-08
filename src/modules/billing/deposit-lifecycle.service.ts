import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox';
import type { WalletRepository } from './wallet.repository';
import type { LedgerRepository } from './ledger.repository';
import type { DepositRepository } from './deposit.repository';
import type { DepositRecord } from './deposit.types';

export interface DepositLifecycleService {
  prepareDepositCheckout(userId: string, amount: number): Promise<DepositRecord>;
  confirmDepositTransaction(
    depositId: string,
    userId: string,
    providerLabel: string,
  ): Promise<void>;
  failDepositTransaction(depositId: string, providerLabel: string, reason: string): Promise<void>;
}

export interface DepositLifecycleServiceDeps {
  prisma: PrismaClient;
  walletRepo: WalletRepository;
  ledgerRepo: LedgerRepository;
  depositRepo: DepositRepository;
  outbox: OutboxPort;
  billingConfig: { minDeposit: number; maxDeposit: number; depositExpiryMs: number };
  logger: Logger;
}

export function createDepositLifecycleService(
  deps: DepositLifecycleServiceDeps,
): DepositLifecycleService {
  const { prisma, walletRepo, ledgerRepo, depositRepo, outbox, billingConfig, logger } = deps;

  /**
   * Validate deposit amount against configured min/max, ensure a wallet
   * exists, and create a PENDING deposit row. Shared by payment providers
   * (Stripe, Cryptomus, ...) so min/max and expiry stay centralized.
   */
  async function prepareDepositCheckout(userId: string, amount: number): Promise<DepositRecord> {
    if (amount < billingConfig.minDeposit) {
      throw new ValidationError(
        `Minimum deposit is $${billingConfig.minDeposit.toFixed(2)}`,
        'MIN_DEPOSIT',
      );
    }
    if (amount > billingConfig.maxDeposit) {
      throw new ValidationError(
        `Maximum deposit is $${billingConfig.maxDeposit.toFixed(2)}`,
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
      expiresAt: new Date(Date.now() + billingConfig.depositExpiryMs),
    });
  }

  /**
   * Atomic deposit confirm: fresh fetch inside tx guards against double
   * credit under concurrent webhook retries. Both Stripe and Cryptomus
   * webhooks call this after verifying their signatures.
   *
   * Emits `deposit.confirmed` into the outbox inside the same transaction
   * as the wallet/ledger/deposit mutations, closing the silent-confirmation
   * gap (no more "credit happened but nobody knows").
   */
  async function confirmDepositTransaction(
    depositId: string,
    userId: string,
    providerLabel: string,
  ): Promise<void> {
    const result = await prisma.$transaction(async (tx) => {
      const deposit = await depositRepo.findDepositById(depositId, userId, tx);
      if (!deposit) {
        logger.warn({ depositId, userId, providerLabel }, 'Deposit not found during confirm');
        return null;
      }
      if (deposit.status !== 'PENDING') {
        logger.debug(
          { depositId, status: deposit.status, providerLabel },
          'Deposit already processed',
        );
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

      await outbox.emit(
        {
          type: 'deposit.confirmed',
          aggregateType: 'deposit',
          aggregateId: depositId,
          userId,
          payload: { depositId, userId, amount, provider: providerLabel },
        },
        tx,
      );

      return { amount };
    });

    if (result) {
      logger.info(
        { userId, depositId, amount: result.amount, providerLabel },
        `${providerLabel} deposit confirmed`,
      );
    }
  }

  /**
   * Mark a PENDING deposit as FAILED inside a transaction. Idempotent.
   * Used when a provider reports unrecoverable failure (Cryptomus 'fail',
   * 'cancel', 'wrong_amount', etc.) or when the expiry worker times out
   * a pending deposit.
   *
   * Emits `deposit.failed` into the outbox inside the same transaction.
   */
  async function failDepositTransaction(
    depositId: string,
    providerLabel: string,
    reason: string,
  ): Promise<void> {
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

      await outbox.emit(
        {
          type: 'deposit.failed',
          aggregateType: 'deposit',
          aggregateId: depositId,
          userId: fresh.userId,
          payload: { depositId, userId: fresh.userId, reason },
        },
        tx,
      );

      logger.info({ depositId, providerLabel, reason }, `${providerLabel} deposit marked FAILED`);
    });
  }

  return { prepareDepositCheckout, confirmDepositTransaction, failDepositTransaction };
}
