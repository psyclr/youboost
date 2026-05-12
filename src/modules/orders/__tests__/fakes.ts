/**
 * Test fakes for the orders module. Mirrors the shape of factory-built
 * dependencies so services can be constructed with fakes the same way
 * production wiring does — no `jest.mock` of repository paths required.
 */

import type { Logger } from 'pino';
import type { Prisma, PrismaClient } from '../../../generated/prisma';
import type { OutboxPort, OutboxEvent } from '../../../shared/outbox';
import type { ProviderSelectorPort, SelectedProvider } from '../ports/provider-selector.port';
import type { CouponsService } from '../../coupons';
import type { ValidateCouponResult } from '../../coupons/coupons.types';
import type { OrdersRepository } from '../orders.repository';
import type { ServicesRepository } from '../service.repository';
import type { FundSettlement } from '../utils/fund-settlement';
import type { CircuitBreaker } from '../utils/circuit-breaker';
import type { ProviderClient } from '../utils/provider-client';
import type { OrderRecord, ServiceRecord, CreateOrderData, UpdateOrderData } from '../orders.types';

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

export function makeServiceRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: 'svc-1',
    name: 'YouTube Views',
    description: null,
    platform: 'YOUTUBE',
    type: 'VIEWS',
    pricePer1000: 2.5 as unknown as ServiceRecord['pricePer1000'],
    minQuantity: 100,
    maxQuantity: 100_000,
    isActive: true,
    providerId: 'prov-1',
    externalServiceId: '101',
    refillDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeOrderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    userId: 'user-1',
    serviceId: 'svc-1',
    providerId: null,
    externalOrderId: null,
    link: 'https://youtube.com/watch?v=test',
    quantity: 1000,
    price: 2.5 as unknown as OrderRecord['price'],
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
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

export interface FakeOrdersRepository extends OrdersRepository {
  orders: OrderRecord[];
  calls: {
    createOrder: CreateOrderData[];
    updateOrderStatus: { orderId: string; data: UpdateOrderData }[];
    findProcessingOrders: number[];
    findTimedOutOrders: number[];
  };
}

export function createFakeOrdersRepository(
  seed: { orders?: OrderRecord[] } = {},
): FakeOrdersRepository {
  const orders: OrderRecord[] = seed.orders ?? [];
  const calls = {
    createOrder: [] as CreateOrderData[],
    updateOrderStatus: [] as { orderId: string; data: UpdateOrderData }[],
    findProcessingOrders: [] as number[],
    findTimedOutOrders: [] as number[],
  };

  return {
    orders,
    calls,
    async createOrder(data): Promise<OrderRecord> {
      calls.createOrder.push(data);
      const record = makeOrderRecord({
        id: `order-${orders.length + 1}`,
        userId: data.userId,
        serviceId: data.serviceId,
        link: data.link,
        quantity: data.quantity,
        price: data.price as unknown as OrderRecord['price'],
        isDripFeed: data.isDripFeed ?? false,
        dripFeedRuns: data.dripFeedRuns ?? null,
        dripFeedInterval: data.dripFeedInterval ?? null,
        dripFeedRunsCompleted: data.dripFeedRunsCompleted ?? 0,
        couponId: data.couponId ?? null,
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
      if (filters.serviceId) filtered = filtered.filter((o) => o.serviceId === filters.serviceId);
      const start = (filters.page - 1) * filters.limit;
      return { orders: filtered.slice(start, start + filters.limit), total: filtered.length };
    },
    async findProcessingOrders(batchSize): Promise<OrderRecord[]> {
      calls.findProcessingOrders.push(batchSize);
      return orders
        .filter((o) => o.status === 'PROCESSING' && o.externalOrderId != null)
        .slice(0, batchSize);
    },
    async updateOrderStatus(orderId, data): Promise<OrderRecord> {
      calls.updateOrderStatus.push({ orderId, data });
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx] as OrderRecord;
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
      const prev = orders[idx] as OrderRecord;
      const next: OrderRecord = {
        ...prev,
        dripFeedRunsCompleted: prev.dripFeedRunsCompleted + 1,
      };
      orders[idx] = next;
      return next;
    },
    async incrementRefillCount(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx] as OrderRecord;
      const next: OrderRecord = { ...prev, refillCount: prev.refillCount + 1 };
      orders[idx] = next;
      return next;
    },
    async pauseDripFeed(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx] as OrderRecord;
      const next: OrderRecord = { ...prev, dripFeedPausedAt: new Date() };
      orders[idx] = next;
      return next;
    },
    async resumeDripFeed(orderId): Promise<OrderRecord> {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error(`Order ${orderId} not found`);
      const prev = orders[idx] as OrderRecord;
      const next: OrderRecord = { ...prev, dripFeedPausedAt: null, updatedAt: new Date() };
      orders[idx] = next;
      return next;
    },
    async findTimedOutOrders(timeoutHours): Promise<OrderRecord[]> {
      calls.findTimedOutOrders.push(timeoutHours);
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

export interface FakeServicesRepository extends ServicesRepository {
  services: ServiceRecord[];
}

export function createFakeServicesRepository(
  seed: { services?: ServiceRecord[] } = {},
): FakeServicesRepository {
  const services: ServiceRecord[] = seed.services ?? [];

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
        services: services
          .slice(start, start + limit)
          .map((s) => ({ ...s, provider: s.providerId ? { id: s.providerId, name: 'p' } : null })),
        total: services.length,
      };
    },
    async findServiceWithProvider(
      id,
    ): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null> {
      const found = services.find((s) => s.id === id);
      return found
        ? { ...found, provider: found.providerId ? { id: found.providerId, name: 'p' } : null }
        : null;
    },
    async createService(data): Promise<ServiceRecord> {
      const record = makeServiceRecord({
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
      return services[idx] as ServiceRecord;
    },
    async deactivateService(id): Promise<ServiceRecord> {
      const idx = services.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Service ${id} not found`);
      const next: ServiceRecord = { ...(services[idx] as ServiceRecord), isActive: false };
      services[idx] = next;
      return next;
    },
  };
}

export interface FakeBilling {
  holdFunds: jest.Mock;
  releaseFunds: jest.Mock;
  chargeFunds: jest.Mock;
  refundFunds: jest.Mock;
  calls: {
    holdFunds: { userId: string; amount: number; orderId: string }[];
    releaseFunds: { userId: string; amount: number; orderId: string }[];
    chargeFunds: { userId: string; amount: number; orderId: string }[];
    refundFunds: { userId: string; amount: number; orderId: string }[];
  };
}

export function createFakeBilling(): FakeBilling {
  const calls = {
    holdFunds: [] as { userId: string; amount: number; orderId: string }[],
    releaseFunds: [] as { userId: string; amount: number; orderId: string }[],
    chargeFunds: [] as { userId: string; amount: number; orderId: string }[],
    refundFunds: [] as { userId: string; amount: number; orderId: string }[],
  };

  const holdFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.holdFunds.push({ userId, amount, orderId });
    },
  );
  const releaseFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.releaseFunds.push({ userId, amount, orderId });
    },
  );
  const chargeFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.chargeFunds.push({ userId, amount, orderId });
    },
  );
  const refundFunds = jest.fn(
    async (userId: string, amount: number, orderId: string): Promise<void> => {
      calls.refundFunds.push({ userId, amount, orderId });
    },
  );

  return { holdFunds, releaseFunds, chargeFunds, refundFunds, calls };
}

export function createFakeProviderClient(
  overrides: Partial<ProviderClient> = {},
): jest.Mocked<ProviderClient> {
  return {
    submitOrder: jest.fn().mockResolvedValue({ externalOrderId: 'ext-1', status: 'processing' }),
    checkStatus: jest
      .fn()
      .mockResolvedValue({ status: 'processing', startCount: 0, completed: 0, remains: 0 }),
    fetchServices: jest.fn().mockResolvedValue([]),
    checkBalance: jest.fn().mockResolvedValue({ balance: 100, currency: 'USD' }),
    ...overrides,
  } as unknown as jest.Mocked<ProviderClient>;
}

export function createFakeProviderSelector(opts: {
  client?: ProviderClient;
  providerId?: string | null;
  selectByIdImpl?: (providerId: string) => Promise<SelectedProvider>;
}): ProviderSelectorPort & {
  calls: { selectProviderById: string[]; selectProvider: number };
} {
  const client = opts.client ?? createFakeProviderClient();
  const defaultSelected: SelectedProvider = { providerId: opts.providerId ?? 'prov-1', client };
  const calls = { selectProviderById: [] as string[], selectProvider: 0 };

  return {
    calls,
    async selectProvider(): Promise<SelectedProvider> {
      calls.selectProvider += 1;
      return defaultSelected;
    },
    async selectProviderById(providerId): Promise<SelectedProvider> {
      calls.selectProviderById.push(providerId);
      if (opts.selectByIdImpl) return opts.selectByIdImpl(providerId);
      return defaultSelected;
    },
  };
}

export interface FakeCouponsService extends CouponsService {
  validateResults: Map<
    string,
    { valid: boolean; discount: number; couponId: string | null; reason?: string }
  >;
  calls: { validateCoupon: { code: string; orderAmount?: number }[]; applyCoupon: string[] };
}

export function createFakeCouponsService(
  results: Record<
    string,
    { valid: boolean; discount: number; couponId: string | null; reason?: string }
  > = {},
): FakeCouponsService {
  const validateResults = new Map(Object.entries(results));
  const calls = {
    validateCoupon: [] as { code: string; orderAmount?: number }[],
    applyCoupon: [] as string[],
  };

  return {
    validateResults,
    calls,
    async createCoupon(): Promise<never> {
      throw new Error('fake.createCoupon not implemented');
    },
    async validateCoupon(code, orderAmount): Promise<ValidateCouponResult> {
      const payload = orderAmount === undefined ? { code } : { code, orderAmount };
      calls.validateCoupon.push(payload);
      const stored = validateResults.get(code);
      if (stored) {
        return {
          valid: stored.valid,
          discount: stored.discount,
          couponId: stored.couponId,
          discountType: null,
          discountValue: null,
          ...(stored.reason ? { reason: stored.reason } : {}),
        };
      }
      return {
        valid: false,
        discount: 0,
        couponId: null,
        discountType: null,
        discountValue: null,
        reason: 'Coupon not found',
      };
    },
    async applyCoupon(couponId): Promise<void> {
      calls.applyCoupon.push(couponId);
    },
    async listCoupons(): Promise<never> {
      throw new Error('fake.listCoupons not implemented');
    },
    async deactivateCoupon(): Promise<never> {
      throw new Error('fake.deactivateCoupon not implemented');
    },
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

export interface FakeFundSettlement extends FundSettlement {
  calls: { settleFunds: { order: OrderRecord; status: string }[] };
}

export function createFakeFundSettlement(): FakeFundSettlement {
  const calls = { settleFunds: [] as { order: OrderRecord; status: string }[] };
  return {
    calls,
    async settleFunds(order, status): Promise<void> {
      calls.settleFunds.push({ order, status });
    },
  };
}

export interface FakeCircuitBreaker extends CircuitBreaker {
  state: {
    open: Map<string, boolean>;
    failures: Map<string, number>;
    successes: Map<string, number>;
  };
}

export function createFakeCircuitBreaker(): FakeCircuitBreaker {
  const state = {
    open: new Map<string, boolean>(),
    failures: new Map<string, number>(),
    successes: new Map<string, number>(),
  };

  return {
    state,
    isOpen(providerId): boolean {
      return state.open.get(providerId) ?? false;
    },
    recordFailure(providerId): void {
      state.failures.set(providerId, (state.failures.get(providerId) ?? 0) + 1);
    },
    recordSuccess(providerId): void {
      state.successes.set(providerId, (state.successes.get(providerId) ?? 0) + 1);
    },
    reset(): void {
      state.open.clear();
      state.failures.clear();
      state.successes.clear();
    },
  };
}
