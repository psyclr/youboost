export type { BillingService, BillingServiceDeps } from './billing.service';
export { createBillingService } from './billing.service';
export type {
  BillingInternalService,
  BillingInternalServiceDeps,
} from './billing-internal.service';
export { createBillingInternalService } from './billing-internal.service';
export type {
  DepositLifecycleService,
  DepositLifecycleServiceDeps,
} from './deposit-lifecycle.service';
export { createDepositLifecycleService } from './deposit-lifecycle.service';
export type { DepositRepository } from './deposit.repository';
export { createDepositRepository } from './deposit.repository';
export type { WalletRepository } from './wallet.repository';
export { createWalletRepository } from './wallet.repository';
export type { LedgerRepository } from './ledger.repository';
export { createLedgerRepository } from './ledger.repository';
export type { StripePaymentService, StripePaymentServiceDeps } from './stripe/stripe.service';
export { createStripePaymentService } from './stripe/stripe.service';
export type { StripeRoutesDeps } from './stripe/stripe.routes';
export { createStripeRoutes } from './stripe/stripe.routes';
export type {
  CryptomusPaymentService,
  CryptomusPaymentServiceDeps,
} from './cryptomus/cryptomus.service';
export { createCryptomusPaymentService } from './cryptomus/cryptomus.service';
export type { CryptomusRoutesDeps } from './cryptomus/cryptomus.routes';
export { createCryptomusRoutes } from './cryptomus/cryptomus.routes';
export type { PaymentProvider, PaymentProviderId } from './providers/types';
export type { PaymentProviderRegistry } from './providers/registry';
export { createPaymentProviderRegistry } from './providers/registry';
export type { BillingRoutesDeps } from './billing.routes';
export { createBillingRoutes } from './billing.routes';
export type { DepositExpiryWorker, DepositExpiryWorkerDeps } from './workers/deposit-expiry.worker';
export { createDepositExpiryWorker } from './workers/deposit-expiry.worker';
export type { DepositDetailResponse } from './deposit.types';

// ---------------------------------------------------------------------------
// Transitional shims for unconverted callers. Delete in sweep phase.
// ---------------------------------------------------------------------------

import type { Prisma } from '../../generated/prisma';
import { getPrisma } from '../../shared/database';
import { getConfig } from '../../shared/config';
import { createServiceLogger } from '../../shared/utils/logger';
import type { DepositRecord } from './deposit.types';
import type { LedgerRecord, WalletRecord, CreateLedgerData } from './billing.types';
import type { DepositStatus, LedgerType } from '../../generated/prisma';
import { createWalletRepository } from './wallet.repository';
import { createLedgerRepository } from './ledger.repository';
import { createDepositRepository } from './deposit.repository';
import { createBillingInternalService } from './billing-internal.service';
import { createDepositLifecycleService } from './deposit-lifecycle.service';
import { createDepositExpiryWorker } from './workers/deposit-expiry.worker';
import { createOutboxRepository, createOutboxService } from '../../shared/outbox';
import type { BillingInternalService } from './billing-internal.service';
import type { DepositLifecycleService } from './deposit-lifecycle.service';
import type { DepositExpiryWorker } from './workers/deposit-expiry.worker';

let _internal: BillingInternalService | null = null;
function getInternal(): BillingInternalService {
  if (!_internal) {
    const prisma = getPrisma();
    _internal = createBillingInternalService({
      prisma,
      walletRepo: createWalletRepository(prisma),
      ledgerRepo: createLedgerRepository(prisma),
      logger: createServiceLogger('billing-internal'),
    });
  }
  return _internal;
}

// Shims for orders/admin still importing top-level fund ops.
export async function holdFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  return getInternal().holdFunds(userId, amount, referenceId);
}
export async function releaseFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  return getInternal().releaseFunds(userId, amount, referenceId);
}
export async function chargeFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  return getInternal().chargeFunds(userId, amount, referenceId);
}
export async function refundFunds(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  return getInternal().refundFunds(userId, amount, referenceId);
}
export async function adjustBalance(userId: string, amount: number, reason: string): Promise<void> {
  return getInternal().adjustBalance(userId, amount, reason);
}

// Namespace shims for admin services still using top-level repos.
export const walletRepo = {
  getOrCreateWallet(userId: string, currency?: string): Promise<WalletRecord> {
    return createWalletRepository(getPrisma()).getOrCreateWallet(userId, currency);
  },
  findWalletByUserId(userId: string, currency?: string): Promise<WalletRecord | null> {
    return createWalletRepository(getPrisma()).findWalletByUserId(userId, currency);
  },
  updateBalance(opts: {
    walletId: string;
    newBalance: number;
    newHold: number;
    tx?: Prisma.TransactionClient;
  }): Promise<WalletRecord> {
    return createWalletRepository(getPrisma()).updateBalance(opts);
  },
};

export const ledgerRepo = {
  createLedgerEntry(data: CreateLedgerData, tx?: Prisma.TransactionClient): Promise<LedgerRecord> {
    return createLedgerRepository(getPrisma()).createLedgerEntry(data, tx);
  },
  findLedgerById(id: string, userId: string): Promise<LedgerRecord | null> {
    return createLedgerRepository(getPrisma()).findLedgerById(id, userId);
  },
  findLedgerEntries(
    userId: string,
    filters: { type?: LedgerType | undefined; page: number; limit: number },
  ): Promise<{ entries: LedgerRecord[]; total: number }> {
    return createLedgerRepository(getPrisma()).findLedgerEntries(userId, filters);
  },
};

export const depositRepo = {
  findDepositById(
    depositId: string,
    userId?: string | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<DepositRecord | null> {
    return createDepositRepository(getPrisma()).findDepositById(depositId, userId, tx);
  },
  findAllDeposits(filters: {
    status?: DepositStatus | undefined;
    userId?: string | undefined;
    page: number;
    limit: number;
  }): Promise<{ deposits: DepositRecord[]; total: number }> {
    return createDepositRepository(getPrisma()).findAllDeposits(filters);
  },
  updateDepositStatus(
    depositId: string,
    data: {
      status: DepositStatus;
      txHash?: string | null;
      confirmedAt?: Date | null;
      ledgerEntryId?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<DepositRecord> {
    return createDepositRepository(getPrisma()).updateDepositStatus(depositId, data, tx);
  },
};

// Deposit-expiry worker shim for src/index.ts. Lazily wires lifecycle + outbox
// using the shared prisma. Delete in sweep phase once index.ts wires workers
// from app-scoped instances.
let _lifecycle: DepositLifecycleService | null = null;
function getLifecycle(): DepositLifecycleService {
  if (!_lifecycle) {
    const prisma = getPrisma();
    const outboxRepo = createOutboxRepository(prisma);
    const outbox = createOutboxService({
      outboxRepo,
      logger: createServiceLogger('outbox'),
    });
    _lifecycle = createDepositLifecycleService({
      prisma,
      walletRepo: createWalletRepository(prisma),
      ledgerRepo: createLedgerRepository(prisma),
      depositRepo: createDepositRepository(prisma),
      outbox,
      billingConfig: getConfig().billing,
      logger: createServiceLogger('deposit-lifecycle'),
    });
  }
  return _lifecycle;
}

let _expiryWorker: DepositExpiryWorker | null = null;
function getExpiryWorker(): DepositExpiryWorker {
  if (!_expiryWorker) {
    const prisma = getPrisma();
    _expiryWorker = createDepositExpiryWorker({
      depositRepo: createDepositRepository(prisma),
      lifecycle: getLifecycle(),
      logger: createServiceLogger('deposit-expiry'),
    });
  }
  return _expiryWorker;
}

export async function startDepositExpiryWorker(): Promise<void> {
  await getExpiryWorker().start();
}

export async function stopDepositExpiryWorker(): Promise<void> {
  await getExpiryWorker().stop();
}
