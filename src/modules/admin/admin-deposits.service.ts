import { createServiceLogger } from '../../shared/utils/logger';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { depositRepo, walletRepo, ledgerRepo } from '../billing';
import type { DepositDetailResponse } from '../billing';

const log = createServiceLogger('admin-deposits');

interface AdminDepositResponse extends DepositDetailResponse {
  userId: string;
}

interface AdminPaginatedDeposits {
  deposits: AdminDepositResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AdminDepositsQuery {
  page: number;
  limit: number;
  status?: string | undefined;
  userId?: string | undefined;
}

export async function listAllDeposits(query: AdminDepositsQuery): Promise<AdminPaginatedDeposits> {
  const { deposits, total } = await depositRepo.findAllDeposits({
    status: query.status as 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'FAILED' | undefined,
    userId: query.userId,
    page: query.page,
    limit: query.limit,
  });

  return {
    deposits: deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      amount: Number(d.amount),
      cryptoAmount: Number(d.cryptoAmount),
      cryptoCurrency: d.cryptoCurrency,
      paymentAddress: d.paymentAddress,
      status: d.status,
      txHash: d.txHash,
      expiresAt: d.expiresAt,
      confirmedAt: d.confirmedAt,
      createdAt: d.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function adminConfirmDeposit(depositId: string): Promise<DepositDetailResponse> {
  const deposit = await depositRepo.findDepositById(depositId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found', 'DEPOSIT_NOT_FOUND');
  }

  if (deposit.status !== 'PENDING') {
    throw new ValidationError('Deposit is not pending', 'DEPOSIT_NOT_PENDING');
  }

  const wallet = await walletRepo.getOrCreateWallet(deposit.userId);
  const balanceBefore = Number(wallet.balance);
  const amount = Number(deposit.amount);
  const newBalance = balanceBefore + amount;

  await walletRepo.updateBalance({
    walletId: wallet.id,
    newBalance,
    newHold: Number(wallet.holdAmount),
  });

  const entry = await ledgerRepo.createLedgerEntry({
    userId: deposit.userId,
    walletId: wallet.id,
    type: 'DEPOSIT',
    amount,
    balanceBefore,
    balanceAfter: newBalance,
    referenceType: 'deposit',
    referenceId: depositId,
    description: `Admin-confirmed deposit $${amount}`,
  });

  const updated = await depositRepo.updateDepositStatus(depositId, {
    status: 'CONFIRMED',
    confirmedAt: new Date(),
    ledgerEntryId: entry.id,
  });

  log.info({ depositId, userId: deposit.userId, amount }, 'Deposit admin-confirmed');

  return {
    id: updated.id,
    amount: Number(updated.amount),
    cryptoAmount: Number(updated.cryptoAmount),
    cryptoCurrency: updated.cryptoCurrency,
    paymentAddress: updated.paymentAddress,
    status: updated.status,
    txHash: updated.txHash,
    expiresAt: updated.expiresAt,
    confirmedAt: updated.confirmedAt,
    createdAt: updated.createdAt,
  };
}

export async function adminExpireDeposit(depositId: string): Promise<DepositDetailResponse> {
  const deposit = await depositRepo.findDepositById(depositId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found', 'DEPOSIT_NOT_FOUND');
  }

  if (deposit.status !== 'PENDING') {
    throw new ValidationError('Deposit is not pending', 'DEPOSIT_NOT_PENDING');
  }

  const updated = await depositRepo.updateDepositStatus(depositId, {
    status: 'EXPIRED',
  });

  log.info({ depositId, userId: deposit.userId }, 'Deposit admin-expired');

  return {
    id: updated.id,
    amount: Number(updated.amount),
    cryptoAmount: Number(updated.cryptoAmount),
    cryptoCurrency: updated.cryptoCurrency,
    paymentAddress: updated.paymentAddress,
    status: updated.status,
    txHash: updated.txHash,
    expiresAt: updated.expiresAt,
    confirmedAt: updated.confirmedAt,
    createdAt: updated.createdAt,
  };
}
