import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { ValidationError } from '../../shared/errors';
import type { WalletRepository } from './wallet.repository';
import type { LedgerRepository } from './ledger.repository';

export interface BillingInternalService {
  holdFunds(userId: string, amount: number, referenceId: string): Promise<void>;
  releaseFunds(userId: string, amount: number, referenceId: string): Promise<void>;
  chargeFunds(userId: string, amount: number, referenceId: string): Promise<void>;
  refundFunds(userId: string, amount: number, referenceId: string): Promise<void>;
  adjustBalance(userId: string, amount: number, reason: string): Promise<void>;
}

export interface BillingInternalServiceDeps {
  prisma: PrismaClient;
  walletRepo: WalletRepository;
  ledgerRepo: LedgerRepository;
  logger: Logger;
}

export function createBillingInternalService(
  deps: BillingInternalServiceDeps,
): BillingInternalService {
  const { prisma, walletRepo, ledgerRepo, logger } = deps;

  async function holdFunds(userId: string, amount: number, referenceId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletRepo.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);
      const available = balance - hold;

      if (available < amount) {
        throw new ValidationError('Insufficient funds', 'INSUFFICIENT_FUNDS');
      }

      const newHold = hold + amount;
      await walletRepo.updateBalance({ walletId: wallet.id, newBalance: balance, newHold, tx });

      await ledgerRepo.createLedgerEntry(
        {
          userId,
          walletId: wallet.id,
          type: 'HOLD',
          amount,
          balanceBefore: balance,
          balanceAfter: balance,
          referenceType: 'order',
          referenceId,
          description: `Hold ${amount} for order ${referenceId}`,
        },
        tx,
      );
    });

    logger.info({ userId, amount, referenceId }, 'Funds held');
  }

  async function releaseFunds(userId: string, amount: number, referenceId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletRepo.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);

      if (hold < amount) {
        throw new ValidationError('Insufficient hold', 'INSUFFICIENT_FUNDS');
      }

      const newHold = hold - amount;
      await walletRepo.updateBalance({ walletId: wallet.id, newBalance: balance, newHold, tx });

      await ledgerRepo.createLedgerEntry(
        {
          userId,
          walletId: wallet.id,
          type: 'RELEASE',
          amount,
          balanceBefore: balance,
          balanceAfter: balance,
          referenceType: 'order',
          referenceId,
          description: `Release ${amount} from order ${referenceId}`,
        },
        tx,
      );
    });

    logger.info({ userId, amount, referenceId }, 'Funds released');
  }

  async function chargeFunds(userId: string, amount: number, referenceId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletRepo.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);

      if (hold < amount) {
        throw new ValidationError('Insufficient hold', 'INSUFFICIENT_FUNDS');
      }

      const newBalance = balance - amount;
      const newHold = hold - amount;
      await walletRepo.updateBalance({ walletId: wallet.id, newBalance, newHold, tx });

      await ledgerRepo.createLedgerEntry(
        {
          userId,
          walletId: wallet.id,
          type: 'WITHDRAW',
          amount,
          balanceBefore: balance,
          balanceAfter: newBalance,
          referenceType: 'order',
          referenceId,
          description: `Charge ${amount} for order ${referenceId}`,
        },
        tx,
      );
    });

    logger.info({ userId, amount, referenceId }, 'Funds charged');
  }

  async function refundFunds(userId: string, amount: number, referenceId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletRepo.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);
      const newBalance = balance + amount;

      await walletRepo.updateBalance({ walletId: wallet.id, newBalance, newHold: hold, tx });

      await ledgerRepo.createLedgerEntry(
        {
          userId,
          walletId: wallet.id,
          type: 'REFUND',
          amount,
          balanceBefore: balance,
          balanceAfter: newBalance,
          referenceType: 'order',
          referenceId,
          description: `Refund ${amount} for order ${referenceId}`,
        },
        tx,
      );
    });

    logger.info({ userId, amount, referenceId }, 'Funds refunded');
  }

  async function adjustBalance(userId: string, amount: number, reason: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const wallet = await walletRepo.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);
      const hold = Number(wallet.holdAmount);
      const newBalance = balance + amount;

      if (newBalance < 0) {
        throw new ValidationError('Insufficient funds for adjustment', 'INSUFFICIENT_FUNDS');
      }

      await walletRepo.updateBalance({ walletId: wallet.id, newBalance, newHold: hold, tx });

      await ledgerRepo.createLedgerEntry(
        {
          userId,
          walletId: wallet.id,
          type: 'ADMIN_ADJUSTMENT',
          amount: Math.abs(amount),
          balanceBefore: balance,
          balanceAfter: newBalance,
          referenceType: 'admin',
          description: reason,
        },
        tx,
      );
    });

    logger.info({ userId, amount, reason }, 'Balance adjusted by admin');
  }

  return { holdFunds, releaseFunds, chargeFunds, refundFunds, adjustBalance };
}
