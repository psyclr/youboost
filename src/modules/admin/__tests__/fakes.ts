/**
 * Test fakes for the admin module. Admin is a fan-in consumer of every
 * other module (auth, billing, orders, providers), so these fakes mirror
 * the interfaces exposed by those modules' factory-built repos and
 * services. Tests inject these via factory DI instead of `jest.mock(...)`
 * on module paths.
 */

import type { Logger } from 'pino';
import type { Prisma, PrismaClient, DepositStatus, OrderStatus } from '../../../generated/prisma';
import type { AdminDashboardRepository } from '../admin-dashboard.repository';
import type { UserRepository } from '../../auth';
import type { WalletRepository, LedgerRepository, DepositRepository } from '../../billing';
import type {
  OrdersRepository,
  ServicesRepository,
  OrderRecord,
  ServiceRecord,
} from '../../orders';
import type { ProvidersRepository } from '../../providers';
import type { WalletRecord, LedgerRecord, CreateLedgerData } from '../../billing/billing.types';
import type { DepositRecord } from '../../billing/deposit.types';
import type { ProviderRecord } from '../../providers/providers.types';

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

// ---------------------------------------------------------------------------
// Admin-dashboard repository
// ---------------------------------------------------------------------------

export interface FakeAdminDashboardRepository extends AdminDashboardRepository {
  _state: {
    countUsers: number;
    countOrders: number;
    countActiveServices: number;
    revenueByStatus: Map<string, number>;
    recentOrders: OrderRecord[];
  };
}

export function createFakeAdminDashboardRepository(
  seed: {
    countUsers?: number;
    countOrders?: number;
    countActiveServices?: number;
    revenue?: number;
    recentOrders?: OrderRecord[];
  } = {},
): FakeAdminDashboardRepository {
  const state = {
    countUsers: seed.countUsers ?? 0,
    countOrders: seed.countOrders ?? 0,
    countActiveServices: seed.countActiveServices ?? 0,
    revenueByStatus: new Map<string, number>(),
    recentOrders: seed.recentOrders ?? [],
  };
  if (seed.revenue !== undefined) {
    state.revenueByStatus.set('COMPLETED,PARTIAL', seed.revenue);
  }

  return {
    _state: state,
    async countUsers(): Promise<number> {
      return state.countUsers;
    },
    async countOrders(): Promise<number> {
      return state.countOrders;
    },
    async countActiveServices(): Promise<number> {
      return state.countActiveServices;
    },
    async sumRevenueByStatuses(statuses: OrderStatus[]): Promise<number> {
      const key = statuses.slice().sort().join(',');
      return state.revenueByStatus.get(key) ?? 0;
    },
    async findRecentOrders(limit: number): Promise<OrderRecord[]> {
      return state.recentOrders.slice(0, limit);
    },
  };
}

// ---------------------------------------------------------------------------
// User repository (from auth module)
// ---------------------------------------------------------------------------

type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: string;
  status: string;
  emailVerified: boolean;
  isAutoCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    email: 'user@test.com',
    username: 'testuser',
    passwordHash: 'hash',
    role: 'USER',
    status: 'ACTIVE',
    emailVerified: true,
    isAutoCreated: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export interface FakeUserRepository extends UserRepository {
  users: UserRecord[];
}

export function createFakeUserRepo(seed: { users?: UserRecord[] } = {}): FakeUserRepository {
  const users: UserRecord[] = seed.users ?? [];

  return {
    users,
    async findByEmail(email): Promise<UserRecord | null> {
      return users.find((u) => u.email === email) ?? null;
    },
    async findByUsername(username): Promise<UserRecord | null> {
      return users.find((u) => u.username === username) ?? null;
    },
    async findById(id): Promise<UserRecord | null> {
      return users.find((u) => u.id === id) ?? null;
    },
    async createUser(data): Promise<UserRecord> {
      const record = makeUserRecord({
        id: `user-${users.length + 1}`,
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
      });
      users.push(record);
      return record;
    },
    async createAutoUser(data): Promise<UserRecord> {
      const record = makeUserRecord({
        id: `user-${users.length + 1}`,
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        isAutoCreated: true,
        emailVerified: false,
      });
      users.push(record);
      return record;
    },
    async finalizeAutoUser(userId, passwordHash): Promise<UserRecord> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) throw new Error(`User ${userId} not found`);
      const next: UserRecord = {
        ...users[idx]!,
        passwordHash,
        isAutoCreated: false,
        emailVerified: true,
      };
      users[idx] = next;
      return next;
    },
    async setEmailVerified(userId): Promise<void> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) return;
      users[idx] = { ...users[idx]!, emailVerified: true };
    },
    async updatePassword(userId, hash): Promise<void> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) return;
      users[idx] = { ...users[idx]!, passwordHash: hash };
    },
    async updateUsername(userId, username): Promise<void> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) return;
      users[idx] = { ...users[idx]!, username };
    },
    async findAllUsers(filters): Promise<{ users: UserRecord[]; total: number }> {
      let filtered = users.slice();
      if (filters.role) filtered = filtered.filter((u) => u.role === filters.role);
      if (filters.status) filtered = filtered.filter((u) => u.status === filters.status);
      const start = (filters.page - 1) * filters.limit;
      return { users: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async updateUserRole(userId, role): Promise<UserRecord> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) throw new Error(`User ${userId} not found`);
      const next = { ...users[idx]!, role };
      users[idx] = next;
      return next;
    },
    async updateUserStatus(userId, status): Promise<UserRecord> {
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) throw new Error(`User ${userId} not found`);
      const next = { ...users[idx]!, status };
      users[idx] = next;
      return next;
    },
  };
}

// ---------------------------------------------------------------------------
// Wallet / Ledger / Deposit repos (from billing module)
// ---------------------------------------------------------------------------

export function createFakeWalletRepo(
  seed: {
    walletId?: string;
    userId?: string;
    balance?: number;
    holdAmount?: number;
    currency?: string;
  } = {},
): WalletRepository & { _walletsByKey: Map<string, WalletRecord> } {
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

export function createFakeLedgerRepo(): LedgerRepository & {
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
    async findLedgerEntries(userId, filters): Promise<{ entries: LedgerRecord[]; total: number }> {
      let filtered = entries.filter((e) => e.userId === userId);
      if (filters.type) filtered = filtered.filter((e) => e.type === filters.type);
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
  cryptoAmount?: number;
  cryptoCurrency?: string;
  paymentAddress?: string;
  txHash?: string | null;
  confirmedAt?: Date | null;
}

export function createFakeDepositRepo(seeds: FakeDepositSeed[] = []): DepositRepository & {
  deposits: DepositRecord[];
} {
  const deposits: DepositRecord[] = seeds.map((s, i) => ({
    id: s.id ?? `dep-${i + 1}`,
    userId: s.userId ?? 'user-1',
    amount: (s.amount ?? 0) as unknown as DepositRecord['amount'],
    cryptoAmount: (s.cryptoAmount ?? 0) as unknown as DepositRecord['cryptoAmount'],
    cryptoCurrency: s.cryptoCurrency ?? 'USDT',
    paymentAddress: s.paymentAddress ?? '',
    status: s.status ?? 'PENDING',
    txHash: s.txHash ?? null,
    expiresAt: s.expiresAt ?? new Date(Date.now() + 3_600_000),
    confirmedAt: s.confirmedAt ?? null,
    ledgerEntryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

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
    async updateDepositStripeSession(): Promise<void> {},
    async updateDepositCryptomusOrder(): Promise<void> {},
    async findDepositByCryptomusOrderId(): Promise<DepositRecord | null> {
      return null;
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

// ---------------------------------------------------------------------------
// Orders / Services repos (from orders module)
// ---------------------------------------------------------------------------

export function makeOrderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    userId: 'user-1',
    serviceId: 'svc-1',
    providerId: null,
    externalOrderId: null,
    link: 'https://youtube.com/watch?v=test',
    quantity: 1000,
    price: 5.99 as unknown as OrderRecord['price'],
    status: 'PENDING',
    startCount: null,
    remains: null,
    isDripFeed: false,
    dripFeedRuns: null,
    dripFeedInterval: null,
    dripFeedRunsCompleted: 0,
    dripFeedPausedAt: null,
    refillEligibleUntil: null,
    refillCount: 0,
    couponId: null,
    discount: 0 as unknown as OrderRecord['discount'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    completedAt: null,
    ...overrides,
  };
}

export function makeServiceRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 'svc-1',
    name: 'YouTube Views',
    description: null,
    platform: 'YOUTUBE',
    type: 'VIEWS',
    pricePer1000: 5.99 as unknown as ServiceRecord['pricePer1000'],
    minQuantity: 100,
    maxQuantity: 100_000,
    isActive: true,
    providerId: 'prov-1',
    externalServiceId: '101',
    refillDays: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export interface FakeOrdersRepository extends OrdersRepository {
  orders: OrderRecord[];
}

export function createFakeOrdersRepo(seed: { orders?: OrderRecord[] } = {}): FakeOrdersRepository {
  const orders: OrderRecord[] = seed.orders ?? [];

  return {
    orders,
    async createOrder(data): Promise<OrderRecord> {
      const record = makeOrderRecord({
        id: `order-${orders.length + 1}`,
        userId: data.userId,
        serviceId: data.serviceId,
        link: data.link,
        quantity: data.quantity,
        price: data.price as unknown as OrderRecord['price'],
      });
      orders.push(record);
      return record;
    },
    async findOrderById(orderId, userId): Promise<OrderRecord | null> {
      return orders.find((o) => o.id === orderId && o.userId === userId) ?? null;
    },
    async findOrderByStripeSessionId(_sessionId): Promise<OrderRecord | null> {
      return null;
    },
    async findPendingPaymentOlderThan(_cutoff, _batchSize): Promise<OrderRecord[]> {
      return [];
    },
    async attachStripeSession(orderId, _sessionId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      return orders[idx]!;
    },
    async findOrders(userId, filters): Promise<{ orders: OrderRecord[]; total: number }> {
      let filtered = orders.filter((o) => o.userId === userId);
      if (filters.status) filtered = filtered.filter((o) => o.status === filters.status);
      const start = (filters.page - 1) * filters.limit;
      return { orders: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async findProcessingOrders(batchSize): Promise<OrderRecord[]> {
      return orders
        .filter((o) => o.status === 'PROCESSING' && o.externalOrderId != null)
        .slice(0, batchSize);
    },
    async updateOrderStatus(orderId, data): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx]!;
      const next: OrderRecord = {
        ...prev,
        status: data.status,
        completedAt: data.completedAt ?? prev.completedAt,
        startCount: data.startCount ?? prev.startCount,
        remains: data.remains ?? prev.remains,
        providerId: data.providerId ?? prev.providerId,
        externalOrderId: data.externalOrderId ?? prev.externalOrderId,
        refillEligibleUntil:
          data.refillEligibleUntil === undefined
            ? prev.refillEligibleUntil
            : data.refillEligibleUntil,
        dripFeedRunsCompleted: data.dripFeedRunsCompleted ?? prev.dripFeedRunsCompleted,
        updatedAt: new Date(),
      };
      orders[idx] = next;
      return next;
    },
    async findDripFeedOrdersDue(): Promise<OrderRecord[]> {
      return orders.filter((o) => o.isDripFeed && o.status === 'PROCESSING');
    },
    async incrementDripFeedRun(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx]!;
      const next = { ...prev, dripFeedRunsCompleted: prev.dripFeedRunsCompleted + 1 };
      orders[idx] = next;
      return next;
    },
    async incrementRefillCount(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx]!;
      const next = { ...prev, refillCount: prev.refillCount + 1 };
      orders[idx] = next;
      return next;
    },
    async pauseDripFeed(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx]!;
      const next = { ...prev, dripFeedPausedAt: new Date() };
      orders[idx] = next;
      return next;
    },
    async resumeDripFeed(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx]!;
      const next = { ...prev, dripFeedPausedAt: null, updatedAt: new Date() };
      orders[idx] = next;
      return next;
    },
    async findTimedOutOrders(timeoutHours): Promise<OrderRecord[]> {
      const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);
      return orders.filter((o) => o.status === 'PROCESSING' && o.updatedAt < cutoff);
    },
    async findAllOrders(filters): Promise<{ orders: OrderRecord[]; total: number }> {
      let filtered = orders.slice();
      if (filters.status) filtered = filtered.filter((o) => o.status === filters.status);
      if (filters.userId) filtered = filtered.filter((o) => o.userId === filters.userId);
      if (filters.isDripFeed !== undefined)
        filtered = filtered.filter((o) => o.isDripFeed === filters.isDripFeed);
      const start = (filters.page - 1) * filters.limit;
      return { orders: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async findOrderByIdAdmin(orderId): Promise<OrderRecord | null> {
      return orders.find((o) => o.id === orderId) ?? null;
    },
  };
}

export interface ServiceWithProviderRecord extends ServiceRecord {
  provider?: { id: string; name: string } | null;
}

export interface FakeServicesRepository extends ServicesRepository {
  services: ServiceWithProviderRecord[];
}

export function createFakeServicesRepo(
  seed: { services?: ServiceWithProviderRecord[] } = {},
): FakeServicesRepository {
  const services: ServiceWithProviderRecord[] = seed.services ?? [];

  return {
    services,
    async findServiceById(id): Promise<ServiceRecord | null> {
      return services.find((s) => s.id === id) ?? null;
    },
    async findActiveServices(): Promise<ServiceRecord[]> {
      return services.filter((s) => s.isActive);
    },
    async findAllServices(): Promise<ServiceRecord[]> {
      return services.slice();
    },
    async findAllServicesPaginatedWithProvider(
      page,
      limit,
    ): Promise<{
      services: Array<ServiceRecord & { provider: { id: string; name: string } | null }>;
      total: number;
    }> {
      const start = (page - 1) * limit;
      return {
        services: services.slice(start, start + limit).map((s) => ({
          ...s,
          provider: s.provider ?? (s.providerId ? { id: s.providerId, name: 'p' } : null),
        })),
        total: services.length,
      };
    },
    async findServiceWithProvider(
      id,
    ): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null> {
      const found = services.find((s) => s.id === id);
      if (!found) return null;
      return {
        ...found,
        provider: found.provider ?? (found.providerId ? { id: found.providerId, name: 'p' } : null),
      };
    },
    async createService(data): Promise<ServiceRecord> {
      const record: ServiceWithProviderRecord = makeServiceRecord({
        id: `svc-${services.length + 1}`,
        name: data.name,
        description: data.description ?? null,
        platform: data.platform,
        type: data.type,
        pricePer1000: data.pricePer1000 as unknown as ServiceRecord['pricePer1000'],
        minQuantity: data.minQuantity,
        maxQuantity: data.maxQuantity,
        providerId: data.providerId ?? null,
        externalServiceId: data.externalServiceId ?? null,
      });
      services.push(record);
      return record;
    },
    async updateService(id, _data): Promise<ServiceRecord> {
      const idx = services.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Service ${id} not found`);
      return services[idx]!;
    },
    async deactivateService(id): Promise<ServiceRecord> {
      const idx = services.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Service ${id} not found`);
      const next: ServiceWithProviderRecord = { ...services[idx]!, isActive: false };
      services[idx] = next;
      return next;
    },
  };
}

// ---------------------------------------------------------------------------
// Providers repo
// ---------------------------------------------------------------------------

export function makeProviderRecord(overrides: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'prov-1',
    name: 'TestProvider',
    apiEndpoint: 'https://example.com/api/v2',
    apiKeyEncrypted: 'enc:xxx',
    priority: 100,
    isActive: true,
    balance: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface FakeProvidersRepository extends ProvidersRepository {
  providers: ProviderRecord[];
}

export function createFakeProvidersRepo(
  seed: { providers?: ProviderRecord[] } = {},
): FakeProvidersRepository {
  const providers: ProviderRecord[] = seed.providers ?? [];

  return {
    providers,
    async createProvider(data): Promise<ProviderRecord> {
      const record = makeProviderRecord({
        id: `prov-${providers.length + 1}`,
        name: data.name,
        apiEndpoint: data.apiEndpoint,
        apiKeyEncrypted: data.apiKeyEncrypted,
        priority: data.priority,
      });
      providers.push(record);
      return record;
    },
    async findProviderById(id): Promise<ProviderRecord | null> {
      return providers.find((p) => p.id === id) ?? null;
    },
    async findProviders(filters): Promise<{ providers: ProviderRecord[]; total: number }> {
      let filtered = providers.slice();
      if (filters.isActive !== undefined)
        filtered = filtered.filter((p) => p.isActive === filters.isActive);
      const start = (filters.page - 1) * filters.limit;
      return {
        providers: filtered.slice(start, start + filters.limit),
        total: filtered.length,
      };
    },
    async findActiveProvidersByPriority(): Promise<ProviderRecord[]> {
      return providers.filter((p) => p.isActive).sort((a, b) => b.priority - a.priority);
    },
    async updateProvider(id, data): Promise<ProviderRecord> {
      const idx = providers.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`Provider ${id} not found`);
      const next = { ...providers[idx]!, ...data };
      providers[idx] = next;
      return next;
    },
  };
}

// ---------------------------------------------------------------------------
// Billing fund-ops fake (chargeFunds / releaseFunds / refundFunds)
// ---------------------------------------------------------------------------

export interface FakeBilling {
  chargeFunds: jest.Mock;
  releaseFunds: jest.Mock;
  refundFunds: jest.Mock;
  calls: {
    chargeFunds: { userId: string; amount: number; orderId: string }[];
    releaseFunds: { userId: string; amount: number; orderId: string }[];
    refundFunds: { userId: string; amount: number; orderId: string }[];
  };
}

export function createFakeBilling(): FakeBilling {
  const calls = {
    chargeFunds: [] as { userId: string; amount: number; orderId: string }[],
    releaseFunds: [] as { userId: string; amount: number; orderId: string }[],
    refundFunds: [] as { userId: string; amount: number; orderId: string }[],
  };

  const chargeFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.chargeFunds.push({ userId, amount, orderId });
    },
  );
  const releaseFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.releaseFunds.push({ userId, amount, orderId });
    },
  );
  const refundFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.refundFunds.push({ userId, amount, orderId });
    },
  );

  return { chargeFunds, releaseFunds, refundFunds, calls };
}
