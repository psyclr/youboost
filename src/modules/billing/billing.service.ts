import { NotFoundError, ValidationError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { toNumber } from './utils/decimal';
import { paymentGateway } from './utils/stub-payment-gateway';
import * as walletRepo from './wallet.repository';
import * as ledgerRepo from './ledger.repository';
import * as depositRepo from './deposit.repository';
import type { LedgerType, DepositStatus } from '../../generated/prisma';
import type {
  DepositInput,
  TransactionsQuery,
  BalanceResponse,
  DepositResponse,
  PaginatedTransactions,
  TransactionDetailed,
} from './billing.types';
import type {
  CreateDepositInput,
  ConfirmDepositInput,
  DepositsQuery,
  DepositRecord,
  DepositDetailResponse,
  PaginatedDeposits,
} from './deposit.types';

const log = createServiceLogger('billing');

export async function getBalance(userId: string): Promise<BalanceResponse> {
  const wallet = await walletRepo.getOrCreateWallet(userId);
  const balance = toNumber(wallet.balance);
  const frozen = toNumber(wallet.holdAmount);

  return {
    userId,
    balance,
    frozen,
    available: balance - frozen,
    currency: wallet.currency,
  };
}

export async function createDeposit(userId: string, input: DepositInput): Promise<DepositResponse> {
  await walletRepo.getOrCreateWallet(userId);

  const payment = await paymentGateway.createPayment({
    amount: input.amount,
    currency: input.currency,
    cryptoCurrency: input.cryptoCurrency,
  });

  const deposit = await depositRepo.createDeposit({
    userId,
    amount: input.amount,
    cryptoAmount: payment.cryptoAmount,
    cryptoCurrency: input.cryptoCurrency,
    paymentAddress: payment.paymentAddress,
    expiresAt: payment.expiresAt,
  });

  log.info({ userId, depositId: deposit.id }, 'Deposit created');

  return {
    depositId: deposit.id,
    paymentAddress: payment.paymentAddress,
    amount: input.amount,
    cryptoAmount: payment.cryptoAmount,
    cryptoCurrency: input.cryptoCurrency,
    expiresAt: payment.expiresAt,
    status: 'pending',
    qrCode: payment.qrCode,
  };
}

export async function initiateDeposit(
  userId: string,
  input: CreateDepositInput,
): Promise<DepositDetailResponse> {
  await walletRepo.getOrCreateWallet(userId);

  const payment = await paymentGateway.createPayment({
    amount: input.amount,
    currency: 'USD',
    cryptoCurrency: input.cryptoCurrency,
  });

  const deposit = await depositRepo.createDeposit({
    userId,
    amount: input.amount,
    cryptoAmount: payment.cryptoAmount,
    cryptoCurrency: input.cryptoCurrency,
    paymentAddress: payment.paymentAddress,
    expiresAt: payment.expiresAt,
  });

  log.info({ userId, depositId: deposit.id }, 'Deposit initiated');

  return {
    id: deposit.id,
    amount: input.amount,
    cryptoAmount: payment.cryptoAmount,
    cryptoCurrency: input.cryptoCurrency,
    paymentAddress: payment.paymentAddress,
    status: 'PENDING',
    txHash: null,
    expiresAt: payment.expiresAt,
    confirmedAt: null,
    createdAt: deposit.createdAt,
  };
}

export async function confirmDeposit(
  depositId: string,
  input: ConfirmDepositInput,
  userId: string,
): Promise<DepositDetailResponse> {
  const deposit = await depositRepo.findDepositById(depositId, userId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found', 'DEPOSIT_NOT_FOUND');
  }

  if (deposit.status !== 'PENDING') {
    throw new ValidationError('Deposit cannot be confirmed', 'DEPOSIT_NOT_PENDING');
  }

  const wallet = await walletRepo.getOrCreateWallet(userId);
  const balanceBefore = toNumber(wallet.balance);
  const amount = toNumber(deposit.amount);
  const newBalance = balanceBefore + amount;

  await walletRepo.updateBalance({
    walletId: wallet.id,
    newBalance,
    newHold: toNumber(wallet.holdAmount),
  });

  const entry = await ledgerRepo.createLedgerEntry({
    userId,
    walletId: wallet.id,
    type: 'DEPOSIT',
    amount,
    balanceBefore,
    balanceAfter: newBalance,
    referenceType: 'deposit',
    referenceId: depositId,
    description: `Deposit ${amount} USD via ${deposit.cryptoCurrency}`,
  });

  const updated = await depositRepo.updateDepositStatus(depositId, {
    status: 'CONFIRMED',
    txHash: input.txHash,
    confirmedAt: new Date(),
    ledgerEntryId: entry.id,
  });

  log.info({ userId, depositId, txHash: input.txHash }, 'Deposit confirmed');

  return {
    id: updated.id,
    amount: toNumber(updated.amount),
    cryptoAmount: toNumber(updated.cryptoAmount),
    cryptoCurrency: updated.cryptoCurrency,
    paymentAddress: updated.paymentAddress,
    status: updated.status,
    txHash: updated.txHash,
    expiresAt: updated.expiresAt,
    confirmedAt: updated.confirmedAt,
    createdAt: updated.createdAt,
  };
}

function mapDepositToResponse(d: DepositRecord): DepositDetailResponse {
  return {
    id: d.id,
    amount: toNumber(d.amount),
    cryptoAmount: toNumber(d.cryptoAmount),
    cryptoCurrency: d.cryptoCurrency,
    paymentAddress: d.paymentAddress,
    status: d.status,
    txHash: d.txHash,
    expiresAt: d.expiresAt,
    confirmedAt: d.confirmedAt,
    createdAt: d.createdAt,
  };
}

export async function listDeposits(
  userId: string,
  query: DepositsQuery,
): Promise<PaginatedDeposits> {
  const { deposits, total } = await depositRepo.findDepositsByUserId(userId, {
    status: query.status as DepositStatus | undefined,
    page: query.page,
    limit: query.limit,
  });

  return {
    deposits: deposits.map(mapDepositToResponse),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getDeposit(
  depositId: string,
  userId: string,
): Promise<DepositDetailResponse> {
  const deposit = await depositRepo.findDepositById(depositId, userId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found', 'DEPOSIT_NOT_FOUND');
  }
  return mapDepositToResponse(deposit);
}

export async function getTransactions(
  userId: string,
  query: TransactionsQuery,
): Promise<PaginatedTransactions> {
  const { entries, total } = await ledgerRepo.findLedgerEntries(userId, {
    type: query.type as LedgerType | undefined,
    page: query.page,
    limit: query.limit,
  });

  return {
    transactions: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: toNumber(e.amount),
      description: e.description,
      createdAt: e.createdAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getTransactionById(
  userId: string,
  transactionId: string,
): Promise<TransactionDetailed> {
  const entry = await ledgerRepo.findLedgerById(transactionId, userId);
  if (!entry) {
    throw new NotFoundError('Transaction not found', 'TRANSACTION_NOT_FOUND');
  }

  return {
    id: entry.id,
    type: entry.type,
    amount: toNumber(entry.amount),
    description: entry.description,
    createdAt: entry.createdAt,
    balanceBefore: toNumber(entry.balanceBefore),
    balanceAfter: toNumber(entry.balanceAfter),
    metadata: entry.metadata,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
  };
}
