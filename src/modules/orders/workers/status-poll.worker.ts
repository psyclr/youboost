import type { Logger } from 'pino';
import type { PrismaClient } from '../../../generated/prisma';
import type { OutboxPort } from '../../../shared/outbox';
import { getNamedQueue, startNamedWorker, stopNamedWorker } from '../../../shared/queue';
import type { ProviderSelectorPort } from '../ports/provider-selector.port';
import type { OrdersRepository } from '../orders.repository';
import type { ServicesRepository } from '../service.repository';
import type { FundSettlement } from '../utils/fund-settlement';
import type { CircuitBreaker } from '../utils/circuit-breaker';
import { mapProviderStatus, isTerminalStatus } from '../utils/status-mapper';
import type { ProviderClient } from '../utils/provider-client';
import type { OrderRecord, UpdateOrderData } from '../orders.types';

const QUEUE_NAME = 'order-polling';

export interface StatusPollWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Exposed for tests — poll one batch synchronously. */
  pollOrderStatuses(): Promise<void>;
}

export interface StatusPollWorkerDeps {
  prisma: PrismaClient;
  ordersRepo: OrdersRepository;
  servicesRepo: ServicesRepository;
  providerSelector: ProviderSelectorPort;
  stubClient: ProviderClient;
  fundSettlement: FundSettlement;
  circuitBreaker: CircuitBreaker;
  outbox: OutboxPort;
  config: {
    intervalMs: number;
    batchSize: number;
    circuitBreakerThreshold: number;
    circuitBreakerCooldownMs: number;
  };
  logger: Logger;
}

export function createStatusPollWorker(deps: StatusPollWorkerDeps): StatusPollWorker {
  const {
    prisma,
    ordersRepo,
    servicesRepo,
    providerSelector,
    stubClient,
    fundSettlement,
    circuitBreaker,
    outbox,
    config,
    logger,
  } = deps;

  function groupByProvider(orders: OrderRecord[]): Map<string, OrderRecord[]> {
    const map = new Map<string, OrderRecord[]>();
    for (const order of orders) {
      const pid = order.providerId ?? 'stub';
      const list = map.get(pid) ?? [];
      list.push(order);
      map.set(pid, list);
    }
    return map;
  }

  async function resolveClient(providerId: string): Promise<ProviderClient> {
    // 'stub' is a sentinel used for orders with a null providerId column
    // (grouped as 'stub' by groupByProvider). selectProviderById would try
    // to hit the DB with 'stub' as id and throw, so short-circuit here.
    if (providerId === 'stub') {
      return stubClient;
    }
    const { client } = await providerSelector.selectProviderById(providerId);
    return client;
  }

  async function emitTerminalEvent(params: {
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
    order: OrderRecord;
    newStatus: string;
    remains: number | null | undefined;
  }): Promise<void> {
    const { tx, order, newStatus, remains } = params;
    if (newStatus === 'COMPLETED') {
      await outbox.emit(
        {
          type: 'order.completed',
          aggregateType: 'order',
          aggregateId: order.id,
          userId: order.userId,
          payload: { orderId: order.id, userId: order.userId, remains: remains ?? null },
        },
        tx,
      );
      return;
    }
    if (newStatus === 'FAILED') {
      await outbox.emit(
        {
          type: 'order.failed',
          aggregateType: 'order',
          aggregateId: order.id,
          userId: order.userId,
          payload: { orderId: order.id, userId: order.userId, reason: 'provider-terminal' },
        },
        tx,
      );
      return;
    }
    if (newStatus === 'PARTIAL') {
      await outbox.emit(
        {
          type: 'order.partial',
          aggregateType: 'order',
          aggregateId: order.id,
          userId: order.userId,
          payload: { orderId: order.id, userId: order.userId, remains: remains ?? 0 },
        },
        tx,
      );
    }
  }

  async function handleRefillEligibilityInTx(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    orderId: string,
    serviceId: string,
  ): Promise<void> {
    try {
      const service = await servicesRepo.findServiceById(serviceId);
      if (service?.refillDays) {
        const eligibleUntil = new Date();
        eligibleUntil.setDate(eligibleUntil.getDate() + service.refillDays);
        await ordersRepo.updateOrderStatus(orderId, {
          status: 'COMPLETED',
          refillEligibleUntil: eligibleUntil,
        });
        logger.info({ orderId, refillDays: service.refillDays }, 'Refill eligibility set');
      }
    } catch (err) {
      logger.error({ orderId, err }, 'Failed to set refill eligibility');
    }
    // tx unused — refill eligibility update reuses the shared prisma via ordersRepo.
    // Wired here so callers can later migrate to tx-aware repo ops.
    void tx;
  }

  async function pollSingleOrder(client: ProviderClient, order: OrderRecord): Promise<void> {
    const externalOrderId = order.externalOrderId ?? '';
    const result = await client.checkStatus(externalOrderId);
    const newStatus = mapProviderStatus(result.status);

    if (newStatus === order.status && !isTerminalStatus(newStatus)) {
      return;
    }

    const updateData: UpdateOrderData = { status: newStatus };
    if (result.startCount !== undefined) updateData.startCount = result.startCount;
    if (result.remains !== undefined) updateData.remains = result.remains;
    if (isTerminalStatus(newStatus)) updateData.completedAt = new Date();

    if (isTerminalStatus(newStatus)) {
      await prisma.$transaction(async (tx) => {
        await ordersRepo.updateOrderStatus(order.id, updateData);
        await emitTerminalEvent({ tx, order, newStatus, remains: result.remains });
        if (newStatus === 'COMPLETED') {
          await handleRefillEligibilityInTx(tx, order.id, order.serviceId);
        }
      });

      const settlementOrder = { ...order, remains: result.remains ?? order.remains };
      await fundSettlement.settleFunds(settlementOrder, newStatus);
    } else {
      await ordersRepo.updateOrderStatus(order.id, updateData);
    }

    logger.info({ orderId: order.id, oldStatus: order.status, newStatus }, 'Order status updated');
  }

  async function pollOrderStatuses(): Promise<void> {
    const { batchSize, circuitBreakerThreshold, circuitBreakerCooldownMs } = config;

    const orders = await ordersRepo.findProcessingOrders(batchSize);
    if (orders.length === 0) {
      logger.debug('No processing orders to poll');
      return;
    }

    logger.info({ count: orders.length }, 'Polling order statuses');

    const grouped = groupByProvider(orders);

    for (const [providerId, providerOrders] of grouped) {
      if (circuitBreaker.isOpen(providerId, circuitBreakerThreshold, circuitBreakerCooldownMs)) {
        logger.warn({ providerId }, 'Circuit breaker open, skipping provider');
        continue;
      }

      let client: ProviderClient;
      try {
        client = await resolveClient(providerId);
      } catch (err) {
        logger.error({ providerId, err }, 'Failed to resolve provider client');
        circuitBreaker.recordFailure(providerId);
        continue;
      }

      for (const order of providerOrders) {
        try {
          await pollSingleOrder(client, order);
          circuitBreaker.recordSuccess(providerId);
        } catch (err) {
          logger.error({ orderId: order.id, providerId, err }, 'Failed to poll order status');
          circuitBreaker.recordFailure(providerId);
        }
      }
    }
  }

  async function start(): Promise<void> {
    await startNamedWorker(
      QUEUE_NAME,
      async () => {
        await pollOrderStatuses();
      },
      { retryable: false, concurrency: 1 },
    );

    const q = getNamedQueue(QUEUE_NAME);
    await q.add('poll-order-statuses', {}, { repeat: { every: config.intervalMs } });

    logger.info({ intervalMs: config.intervalMs }, 'Order polling started');
  }

  async function stop(): Promise<void> {
    await stopNamedWorker(QUEUE_NAME);
    logger.info('Order polling stopped');
  }

  return { start, stop, pollOrderStatuses };
}
