import type { Logger } from 'pino';
import { NotFoundError } from '../../shared/errors';
import type { WalletRepository } from './wallet.repository';
import type { LedgerRepository } from './ledger.repository';
import type { DepositRepository } from './deposit.repository';
import type {
  TransactionsQuery,
  BalanceResponse,
  PaginatedTransactions,
  TransactionDetailed,
} from './billing.types';
import type {
  DepositsQuery,
  DepositRecord,
  DepositDetailResponse,
  PaginatedDeposits,
} from './deposit.types';

export interface BillingService {
  getBalance(userId: string): Promise<BalanceResponse>;
  listDeposits(userId: string, query: DepositsQuery): Promise<PaginatedDeposits>;
  getDeposit(depositId: string, userId: string): Promise<DepositDetailResponse>;
  getTransactions(userId: string, query: TransactionsQuery): Promise<PaginatedTransactions>;
  getTransactionById(userId: string, transactionId: string): Promise<TransactionDetailed>;
}

export interface BillingServiceDeps {
  walletRepo: WalletRepository;
  ledgerRepo: LedgerRepository;
  depositRepo: DepositRepository;
  logger: Logger;
}

function mapDepositToResponse(d: DepositRecord): DepositDetailResponse {
  return {
    id: d.id,
    amount: Number(d.amount),
    cryptoAmount: Number(d.cryptoAmount),
    cryptoCurrency: d.cryptoCurrency,
    paymentAddress: d.paymentAddress,
    status: d.status,
    txHash: d.txHash,
    expiresAt: d.expiresAt,
    confirmedAt: d.confirmedAt,
    createdAt: d.createdAt,
  };
}

export function createBillingService(deps: BillingServiceDeps): BillingService {
  const { walletRepo, ledgerRepo, depositRepo } = deps;

  async function getBalance(userId: string): Promise<BalanceResponse> {
    const wallet = await walletRepo.getOrCreateWallet(userId);
    const balance = Number(wallet.balance);
    const frozen = Number(wallet.holdAmount);

    return {
      userId,
      balance,
      frozen,
      available: balance - frozen,
      currency: wallet.currency,
    };
  }

  async function listDeposits(userId: string, query: DepositsQuery): Promise<PaginatedDeposits> {
    const { deposits, total } = await depositRepo.findDepositsByUserId(userId, {
      status: query.status,
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

  async function getDeposit(depositId: string, userId: string): Promise<DepositDetailResponse> {
    const deposit = await depositRepo.findDepositById(depositId, userId);
    if (!deposit) {
      throw new NotFoundError('Deposit not found', 'DEPOSIT_NOT_FOUND');
    }
    return mapDepositToResponse(deposit);
  }

  async function getTransactions(
    userId: string,
    query: TransactionsQuery,
  ): Promise<PaginatedTransactions> {
    const { entries, total } = await ledgerRepo.findLedgerEntries(userId, {
      type: query.type,
      page: query.page,
      limit: query.limit,
    });

    return {
      transactions: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: Number(e.amount),
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

  async function getTransactionById(
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
      amount: Number(entry.amount),
      description: entry.description,
      createdAt: entry.createdAt,
      balanceBefore: Number(entry.balanceBefore),
      balanceAfter: Number(entry.balanceAfter),
      metadata: entry.metadata,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
    };
  }

  return { getBalance, listDeposits, getDeposit, getTransactions, getTransactionById };
}
