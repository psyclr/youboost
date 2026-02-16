import { NotFoundError } from '../../shared/errors';
import { createServiceLogger } from '../../shared/utils/logger';
import { toNumber } from './utils/decimal';
import { paymentGateway } from './utils/stub-payment-gateway';
import * as walletRepo from './wallet.repository';
import * as ledgerRepo from './ledger.repository';
import type { LedgerType } from '../../generated/prisma';
import type {
  DepositInput,
  TransactionsQuery,
  BalanceResponse,
  DepositResponse,
  PaginatedTransactions,
  TransactionDetailed,
} from './billing.types';

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
  const wallet = await walletRepo.getOrCreateWallet(userId);

  const payment = await paymentGateway.createPayment({
    amount: input.amount,
    currency: input.currency,
    cryptoCurrency: input.cryptoCurrency,
  });

  const balanceBefore = toNumber(wallet.balance);
  const entry = await ledgerRepo.createLedgerEntry({
    userId,
    walletId: wallet.id,
    type: 'DEPOSIT',
    amount: input.amount,
    balanceBefore,
    balanceAfter: balanceBefore,
    description: `Deposit ${input.amount} USD via ${input.cryptoCurrency}`,
    metadata: { cryptoCurrency: input.cryptoCurrency, status: 'pending' },
  });

  log.info({ userId, depositId: entry.id }, 'Deposit created');

  return {
    depositId: entry.id,
    paymentAddress: payment.paymentAddress,
    amount: input.amount,
    cryptoAmount: payment.cryptoAmount,
    cryptoCurrency: input.cryptoCurrency,
    expiresAt: payment.expiresAt,
    status: 'pending',
    qrCode: payment.qrCode,
  };
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
