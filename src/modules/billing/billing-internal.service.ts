import { getPrisma } from '../../shared/database';
import { ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { toNumber } from './utils/decimal';
import * as walletRepo from './wallet.repository';
import * as ledgerRepo from './ledger.repository';

const log = createServiceLogger('billing-internal');

export async function holdFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.getOrCreateWallet(userId);
    const balance = toNumber(wallet.balance);
    const hold = toNumber(wallet.holdAmount);
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

  log.info({ userId, amount, referenceId }, 'Funds held');
}

export async function releaseFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.getOrCreateWallet(userId);
    const balance = toNumber(wallet.balance);
    const hold = toNumber(wallet.holdAmount);

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

  log.info({ userId, amount, referenceId }, 'Funds released');
}

export async function chargeFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.getOrCreateWallet(userId);
    const balance = toNumber(wallet.balance);
    const hold = toNumber(wallet.holdAmount);

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

  log.info({ userId, amount, referenceId }, 'Funds charged');
}

export async function refundFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const wallet = await walletRepo.getOrCreateWallet(userId);
    const balance = toNumber(wallet.balance);
    const hold = toNumber(wallet.holdAmount);
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

  log.info({ userId, amount, referenceId }, 'Funds refunded');
}
