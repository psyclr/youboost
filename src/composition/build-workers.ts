import type { PrismaClient } from '../generated/prisma';
import { createServiceLogger } from '../shared/utils/logger';
import type { getConfig } from '../shared/config';
import type {
  OrdersRepository,
  ServicesRepository,
  OrdersService,
  FundSettlement,
  CircuitBreaker,
  OrderTimeoutWorker,
  StatusPollWorker,
  DripFeedWorker,
  PendingPaymentExpiryWorker,
} from '../modules/orders';
import {
  createOrderTimeoutWorker,
  createStatusPollWorker,
  createDripFeedWorker,
  createPendingPaymentExpiryWorker,
  stubProviderClient,
} from '../modules/orders';
import type { ProviderSelector } from '../modules/providers';
import type {
  DepositRepository,
  DepositLifecycleService,
  DepositExpiryWorker,
} from '../modules/billing';
import { createDepositExpiryWorker } from '../modules/billing';
import type { OutboxPort } from '../shared/outbox';

type AppConfig = ReturnType<typeof getConfig>;

export interface OrderWorkerSet {
  orderTimeoutWorker: OrderTimeoutWorker;
  statusPollWorker: StatusPollWorker;
  dripFeedWorker: DripFeedWorker;
  depositExpiryWorker: DepositExpiryWorker;
  pendingPaymentExpiryWorker: PendingPaymentExpiryWorker;
}

export interface BuildOrderWorkersDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  ordersService: OrdersService;
  providerSelector: ProviderSelector;
  fundSettlement: FundSettlement;
  circuitBreaker: CircuitBreaker;
  outbox: OutboxPort;
  depositRepo: DepositRepository;
  depositLifecycle: DepositLifecycleService;
  config: AppConfig;
}

export function buildOrderWorkers(deps: BuildOrderWorkersDeps): OrderWorkerSet {
  const orderTimeoutWorker = createOrderTimeoutWorker({
    prisma: deps.prisma,
    ordersRepo: deps.ordersRepo,
    providerSelector: deps.providerSelector,
    stubClient: stubProviderClient,
    fundSettlement: deps.fundSettlement,
    outbox: deps.outbox,
    config: { orderTimeoutHours: deps.config.polling.orderTimeoutHours },
    logger: createServiceLogger('order-timeout'),
  });
  const statusPollWorker = createStatusPollWorker({
    prisma: deps.prisma,
    ordersRepo: deps.ordersRepo,
    servicesRepo: deps.servicesRepo,
    providerSelector: deps.providerSelector,
    stubClient: stubProviderClient,
    fundSettlement: deps.fundSettlement,
    circuitBreaker: deps.circuitBreaker,
    outbox: deps.outbox,
    config: {
      intervalMs: deps.config.polling.intervalMs,
      batchSize: deps.config.polling.batchSize,
      circuitBreakerThreshold: deps.config.polling.circuitBreakerThreshold,
      circuitBreakerCooldownMs: deps.config.polling.circuitBreakerCooldownMs,
    },
    logger: createServiceLogger('status-poll'),
  });
  const dripFeedWorker = createDripFeedWorker({
    ordersRepo: deps.ordersRepo,
    servicesRepo: deps.servicesRepo,
    providerSelector: deps.providerSelector,
    ordersService: deps.ordersService,
    logger: createServiceLogger('drip-feed-worker'),
  });
  const depositExpiryWorker = createDepositExpiryWorker({
    depositRepo: deps.depositRepo,
    lifecycle: deps.depositLifecycle,
    logger: createServiceLogger('deposit-expiry'),
  });
  const pendingPaymentExpiryWorker = createPendingPaymentExpiryWorker({
    prisma: deps.prisma,
    ordersRepo: deps.ordersRepo,
    outbox: deps.outbox,
    config: {
      pendingPaymentTtlMinutes: deps.config.billing.pendingPaymentTtlMinutes,
    },
    logger: createServiceLogger('pending-payment-expiry'),
  });
  return {
    orderTimeoutWorker,
    statusPollWorker,
    dripFeedWorker,
    depositExpiryWorker,
    pendingPaymentExpiryWorker,
  };
}
