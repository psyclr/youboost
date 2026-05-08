/**
 * Test fakes for the billing module. All fakes implement the same
 * interfaces as the factory-built repositories + services, so services
 * built from `createXxxService({ ...fakes })` behave identically to
 * production wiring — minus the DB. Tests inject these via factory DI
 * instead of `jest.mock(...)` on repository module paths.
 */

import type { Logger } from 'pino';
import type { Prisma, PrismaClient, DepositStatus, LedgerType } from '../../../generated/prisma';
import type { WalletRepository } from '../wallet.repository';
import type { LedgerRepository } from '../ledger.repository';
import type { DepositRepository } from '../deposit.repository';
import type { WalletRecord, LedgerRecord, CreateLedgerData } from '../billing.types';
import type { DepositRecord } from '../deposit.types';
import type { OutboxPort, OutboxEvent } from '../../../shared/outbox';

/** No-op logger suitable for tests — swallows all log levels. */
export const silentLogger: Logger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: (): Logger => silentLogger,
  level: 'silent',
  silent: jest.fn(),
  bindings: (): Record<string, unknown> => ({}),
  isLevelEnabled: (): boolean => false,
} as unknown as Logger;

/**
 * Minimal prisma stub with a passthrough `$transaction` that invokes the
 * callback with a sentinel tx object. Good enough for services that only
 * care about "tx was used". For real DB simulation, use real prisma.
 */
export interface FakePrisma {
  client: PrismaClient;
  transactionCalls: number;
  tx: Prisma.TransactionClient;
}

export function createFakePrisma(): FakePrisma {
  const tx = {} as Prisma.TransactionClient;
  const state = { transactionCalls: 0 };
  const client = {
    $transaction: async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
      state.transactionCalls += 1;
      return cb(tx);
    },
  } as unknown as PrismaClient;
  return {
    client,
    get transactionCalls(): number {
      return state.transactionCalls;
    },
    tx,
  };
}

export interface FakeWalletSeed {
  walletId?: string;
  userId?: string;
  balance?: number;
  holdAmount?: number;
  currency?: string;
}

export function createFakeWalletRepository(seed: FakeWalletSeed = {}): WalletRepository & {
  _walletsByKey: Map<string, WalletRecord>;
} {
  const walletsByKey = new Map<string, WalletRecord>();

  function makeWallet(userId: string, currency: string, balance = 0, holdAmount = 0): WalletRecord {
    return {
      id: seed.walletId ?? `wallet-${userId}-${currency}`,
      userId,
      balance: balance as unknown as WalletRecord['balance'],
      currency,
      holdAmount: holdAmount as unknown as WalletRecord['holdAmount'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (seed.userId) {
    const key = `${seed.userId}:${seed.currency ?? 'USD'}`;
    walletsByKey.set(
      key,
      makeWallet(seed.userId, seed.currency ?? 'USD', seed.balance ?? 0, seed.holdAmount ?? 0),
    );
  }

  return {
    async getOrCreateWallet(userId, currency = 'USD'): Promise<WalletRecord> {
      const key = `${userId}:${currency}`;
      const existing = walletsByKey.get(key);
      if (existing) return existing;
      const created = makeWallet(userId, currency);
      walletsByKey.set(key, created);
      return created;
    },
    async findWalletByUserId(userId, currency = 'USD'): Promise<WalletRecord | null> {
      return walletsByKey.get(`${userId}:${currency}`) ?? null;
    },
    async updateBalance(opts): Promise<WalletRecord> {
      for (const [key, w] of walletsByKey) {
        if (w.id === opts.walletId) {
          const updated: WalletRecord = {
            ...w,
            balance: opts.newBalance as unknown as WalletRecord['balance'],
            holdAmount: opts.newHold as unknown as WalletRecord['holdAmount'],
            updatedAt: new Date(),
          };
          walletsByKey.set(key, updated);
          return updated;
        }
      }
      throw new Error(`Wallet ${opts.walletId} not found`);
    },
    _walletsByKey: walletsByKey,
  };
}

export function createFakeLedgerRepository(): LedgerRepository & {
  entries: LedgerRecord[];
  createCalls: { data: CreateLedgerData; tx: Prisma.TransactionClient | undefined }[];
} {
  const entries: LedgerRecord[] = [];
  const createCalls: {
    data: CreateLedgerData;
    tx: Prisma.TransactionClient | undefined;
  }[] = [];

  return {
    async createLedgerEntry(data, tx): Promise<LedgerRecord> {
      createCalls.push({ data, tx });
      const entry: LedgerRecord = {
        id: `ledger-${entries.length + 1}`,
        userId: data.userId,
        walletId: data.walletId,
        type: data.type,
        amount: data.amount as unknown as LedgerRecord['amount'],
        balanceBefore: data.balanceBefore as unknown as LedgerRecord['balanceBefore'],
        balanceAfter: data.balanceAfter as unknown as LedgerRecord['balanceAfter'],
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? null,
        createdAt: new Date(),
      };
      entries.push(entry);
      return entry;
    },
    async findLedgerById(id, userId): Promise<LedgerRecord | null> {
      return entries.find((e) => e.id === id && e.userId === userId) ?? null;
    },
    async findLedgerEntries(
      userId,
      filters: { type?: LedgerType | undefined; page: number; limit: number },
    ): Promise<{ entries: LedgerRecord[]; total: number }> {
      let filtered = entries.filter((e) => e.userId === userId);
      if (filters.type) {
        filtered = filtered.filter((e) => e.type === filters.type);
      }
      const start = (filters.page - 1) * filters.limit;
      return { entries: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    entries,
    createCalls,
  };
}

export interface FakeDepositSeed {
  id?: string;
  userId?: string;
  amount?: number;
  status?: DepositStatus;
  expiresAt?: Date;
  cryptomusOrderId?: string | null;
}

export function createFakeDepositRepository(seeds: FakeDepositSeed[] = []): DepositRepository & {
  deposits: DepositRecord[];
} {
  const deposits: DepositRecord[] = seeds.map((s, i) => ({
    id: s.id ?? `dep-${i + 1}`,
    userId: s.userId ?? 'user-1',
    amount: (s.amount ?? 0) as unknown as DepositRecord['amount'],
    cryptoAmount: 0 as unknown as DepositRecord['cryptoAmount'],
    cryptoCurrency: '',
    paymentAddress: '',
    status: s.status ?? 'PENDING',
    txHash: null,
    expiresAt: s.expiresAt ?? new Date(Date.now() + 3_600_000),
    confirmedAt: null,
    ledgerEntryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  // cryptomusOrderId is not on DepositRecord type but the underlying row has
  // it; we store it in a side map for findDepositByCryptomusOrderId.
  const orderIdByDepositId = new Map<string, string>();
  seeds.forEach((s, i) => {
    const id = s.id ?? `dep-${i + 1}`;
    if (s.cryptomusOrderId) orderIdByDepositId.set(s.cryptomusOrderId, id);
  });

  return {
    async createDeposit(data): Promise<DepositRecord> {
      const created: DepositRecord = {
        id: `dep-${deposits.length + 1}`,
        userId: data.userId,
        amount: data.amount as unknown as DepositRecord['amount'],
        cryptoAmount: data.cryptoAmount as unknown as DepositRecord['cryptoAmount'],
        cryptoCurrency: data.cryptoCurrency,
        paymentAddress: data.paymentAddress,
        status: 'PENDING',
        txHash: null,
        expiresAt: data.expiresAt,
        confirmedAt: null,
        ledgerEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      deposits.push(created);
      return created;
    },
    async findDepositById(depositId, userId): Promise<DepositRecord | null> {
      const match = deposits.find((d) => d.id === depositId);
      if (!match) return null;
      if (userId && match.userId !== userId) return null;
      return match;
    },
    async findDepositsByUserId(
      userId,
      filters,
    ): Promise<{ deposits: DepositRecord[]; total: number }> {
      let filtered = deposits.filter((d) => d.userId === userId);
      if (filters.status) filtered = filtered.filter((d) => d.status === filters.status);
      const start = (filters.page - 1) * filters.limit;
      return { deposits: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async findAllDeposits(filters): Promise<{ deposits: DepositRecord[]; total: number }> {
      let filtered = deposits.slice();
      if (filters.status) filtered = filtered.filter((d) => d.status === filters.status);
      if (filters.userId) filtered = filtered.filter((d) => d.userId === filters.userId);
      const start = (filters.page - 1) * filters.limit;
      return { deposits: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async findExpiredPendingDeposits(): Promise<DepositRecord[]> {
      const now = new Date();
      return deposits.filter((d) => d.status === 'PENDING' && d.expiresAt < now);
    },
    async updateDepositStripeSession(): Promise<void> {
      // No-op for tests; real repo writes stripeSessionId + paymentMethod.
    },
    async updateDepositCryptomusOrder(depositId, data): Promise<void> {
      orderIdByDepositId.set(data.cryptomusOrderId, depositId);
    },
    async findDepositByCryptomusOrderId(cryptomusOrderId): Promise<DepositRecord | null> {
      const id = orderIdByDepositId.get(cryptomusOrderId);
      if (!id) return null;
      return deposits.find((d) => d.id === id) ?? null;
    },
    async updateDepositStatus(depositId, data): Promise<DepositRecord> {
      const idx = deposits.findIndex((d) => d.id === depositId);
      if (idx === -1) throw new Error(`Deposit ${depositId} not found`);
      const prev = deposits[idx]!;
      const next: DepositRecord = {
        ...prev,
        status: data.status,
        txHash: data.txHash ?? prev.txHash,
        confirmedAt: data.confirmedAt ?? prev.confirmedAt,
        ledgerEntryId: data.ledgerEntryId ?? prev.ledgerEntryId,
        updatedAt: new Date(),
      };
      deposits[idx] = next;
      return next;
    },
    deposits,
  };
}

export interface FakeOutbox {
  port: OutboxPort;
  events: { event: OutboxEvent; tx: Prisma.TransactionClient }[];
}

export function createFakeOutbox(): FakeOutbox {
  const events: { event: OutboxEvent; tx: Prisma.TransactionClient }[] = [];
  return {
    port: {
      async emit(event, tx): Promise<void> {
        events.push({ event, tx });
      },
    },
    events,
  };
}
