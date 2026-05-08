import { createStatusPollWorker } from '../status-poll.worker';
import type { OrderRecord } from '../../orders.types';
import type { StatusResult, ProviderClient } from '../../utils/provider-client';
import {
  createFakeOrdersRepository,
  createFakeServicesRepository,
  createFakeFundSettlement,
  createFakeCircuitBreaker,
  createFakeOutbox,
  createFakePrisma,
  createFakeProviderClient,
  createFakeProviderSelector,
  silentLogger,
  makeOrderRecord,
  type FakeOrdersRepository,
} from '../../__tests__/fakes';

function makeProcessingOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return makeOrderRecord({
    status: 'PROCESSING',
    providerId: 'stub',
    externalOrderId: 'ext-1',
    ...overrides,
  });
}

function makeStatus(overrides: Partial<StatusResult> = {}): StatusResult {
  return { status: 'completed', startCount: 100, completed: 1000, remains: 0, ...overrides };
}

interface Harness {
  pollOrderStatuses: () => Promise<void>;
  ordersRepo: FakeOrdersRepository;
  outbox: ReturnType<typeof createFakeOutbox>;
  circuitBreaker: ReturnType<typeof createFakeCircuitBreaker>;
  fundSettlement: ReturnType<typeof createFakeFundSettlement>;
  stubClient: jest.Mocked<ProviderClient>;
  realClient: jest.Mocked<ProviderClient>;
  providerSelectorCalls: { selectProviderById: string[]; selectProvider: number };
}

function buildHarness(initialOrders: OrderRecord[] = []): Harness {
  const ordersRepo = createFakeOrdersRepository({ orders: initialOrders });
  const servicesRepo = createFakeServicesRepository();
  const fundSettlement = createFakeFundSettlement();
  const circuitBreaker = createFakeCircuitBreaker();
  const outbox = createFakeOutbox();
  const prisma = createFakePrisma();
  const stubClient = createFakeProviderClient();
  const realClient = createFakeProviderClient();
  const providerSelector = createFakeProviderSelector({
    client: realClient,
    providerId: 'prov-1',
  });

  const worker = createStatusPollWorker({
    prisma: prisma.client,
    ordersRepo,
    servicesRepo,
    providerSelector,
    stubClient,
    fundSettlement,
    circuitBreaker,
    outbox: outbox.port,
    config: {
      intervalMs: 30_000,
      batchSize: 100,
      circuitBreakerThreshold: 5,
      circuitBreakerCooldownMs: 60_000,
    },
    logger: silentLogger,
  });

  return {
    pollOrderStatuses: worker.pollOrderStatuses,
    ordersRepo,
    outbox,
    circuitBreaker,
    fundSettlement,
    stubClient,
    realClient,
    providerSelectorCalls: providerSelector.calls,
  };
}

describe('Status Poll Worker (factory)', () => {
  it('should do nothing when no processing orders', async () => {
    const h = buildHarness();
    await h.pollOrderStatuses();
    expect(h.ordersRepo.calls.updateOrderStatus).toHaveLength(0);
    expect(h.stubClient.checkStatus).not.toHaveBeenCalled();
  });

  it('should poll status for stub provider orders', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'completed' }));
    await h.pollOrderStatuses();
    expect(h.stubClient.checkStatus).toHaveBeenCalledWith('ext-1');
    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data.status).toBe('COMPLETED');
  });

  it('should settle funds on terminal status', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'completed', remains: 0 }));
    await h.pollOrderStatuses();
    expect(h.fundSettlement.calls.settleFunds[0]?.status).toBe('COMPLETED');
    expect(h.fundSettlement.calls.settleFunds[0]?.order.remains).toBe(0);
  });

  it('should not settle funds on non-terminal status', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.fundSettlement.calls.settleFunds).toHaveLength(0);
  });

  it('should skip update when status unchanged and non-terminal', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.ordersRepo.calls.updateOrderStatus).toHaveLength(0);
  });

  it('should skip providers with open circuit breaker', async () => {
    const h = buildHarness([makeProcessingOrder({ providerId: 'provider-1' })]);
    h.circuitBreaker.state.open.set('provider-1', true);
    await h.pollOrderStatuses();
    expect(h.stubClient.checkStatus).not.toHaveBeenCalled();
    expect(h.realClient.checkStatus).not.toHaveBeenCalled();
  });

  it('should record success on successful poll', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.circuitBreaker.state.successes.get('stub')).toBe(1);
  });

  it('should record failure on poll error', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockRejectedValue(new Error('provider error'));
    await h.pollOrderStatuses();
    expect(h.circuitBreaker.state.failures.get('stub')).toBe(1);
  });

  it('should continue processing other orders after individual failure', async () => {
    const order1 = makeProcessingOrder({ id: 'order-1', externalOrderId: 'ext-1' });
    const order2 = makeProcessingOrder({ id: 'order-2', externalOrderId: 'ext-2' });
    const h = buildHarness([order1, order2]);
    h.stubClient.checkStatus
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeStatus({ status: 'completed' }));
    await h.pollOrderStatuses();
    expect(h.stubClient.checkStatus).toHaveBeenCalledTimes(2);
    expect(h.ordersRepo.calls.updateOrderStatus).toHaveLength(1);
  });

  it('should group orders by providerId', async () => {
    const order1 = makeProcessingOrder({ id: 'o1', providerId: 'stub' });
    const order2 = makeProcessingOrder({ id: 'o2', providerId: 'provider-2' });
    const h = buildHarness([order1, order2]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    h.realClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.stubClient.checkStatus).toHaveBeenCalledTimes(1);
    expect(h.realClient.checkStatus).toHaveBeenCalledTimes(1);
  });

  it('should resolve real provider via selectProviderById', async () => {
    const h = buildHarness([makeProcessingOrder({ providerId: 'real-provider' })]);
    h.realClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.providerSelectorCalls.selectProviderById).toContain('real-provider');
  });

  it('should record failure when provider resolution fails', async () => {
    const ordersRepo = createFakeOrdersRepository({
      orders: [makeProcessingOrder({ providerId: 'missing-provider' })],
    });
    const servicesRepo = createFakeServicesRepository();
    const fundSettlement = createFakeFundSettlement();
    const circuitBreaker = createFakeCircuitBreaker();
    const outbox = createFakeOutbox();
    const prisma = createFakePrisma();
    const stubClient = createFakeProviderClient();
    const failingSelector = createFakeProviderSelector({
      client: createFakeProviderClient(),
      selectByIdImpl: async () => {
        throw new Error('provider not found');
      },
    });

    const worker = createStatusPollWorker({
      prisma: prisma.client,
      ordersRepo,
      servicesRepo,
      providerSelector: failingSelector,
      stubClient,
      fundSettlement,
      circuitBreaker,
      outbox: outbox.port,
      config: {
        intervalMs: 30_000,
        batchSize: 100,
        circuitBreakerThreshold: 5,
        circuitBreakerCooldownMs: 60_000,
      },
      logger: silentLogger,
    });

    await worker.pollOrderStatuses();
    expect(circuitBreaker.state.failures.get('missing-provider')).toBe(1);
  });

  it('should set completedAt for terminal statuses', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'completed' }));
    await h.pollOrderStatuses();
    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data.completedAt).toBeInstanceOf(Date);
  });

  it('should handle orders with null providerId as stub', async () => {
    const h = buildHarness([makeProcessingOrder({ providerId: null })]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.stubClient.checkStatus).toHaveBeenCalled();
  });

  it('should update startCount and remains from provider response', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(
      makeStatus({ status: 'partial', startCount: 500, remains: 200 }),
    );
    await h.pollOrderStatuses();
    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data).toMatchObject({
      status: 'PARTIAL',
      startCount: 500,
      remains: 200,
    });
  });

  it('should pass updated remains to settleFunds for partial orders', async () => {
    const h = buildHarness([makeProcessingOrder({ quantity: 1000 })]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'partial', remains: 300 }));
    await h.pollOrderStatuses();
    expect(h.fundSettlement.calls.settleFunds[0]?.order.remains).toBe(300);
    expect(h.fundSettlement.calls.settleFunds[0]?.status).toBe('PARTIAL');
  });

  it('should use batchSize from config', async () => {
    const h = buildHarness();
    await h.pollOrderStatuses();
    expect(h.ordersRepo.calls.findProcessingOrders).toContain(100);
  });

  it('should emit order.completed event on COMPLETED status', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'completed', remains: 0 }));
    await h.pollOrderStatuses();
    const completed = h.outbox.events.find((e) => e.event.type === 'order.completed');
    expect(completed?.event).toMatchObject({
      type: 'order.completed',
      aggregateType: 'order',
      aggregateId: 'order-1',
      userId: 'user-1',
      payload: { orderId: 'order-1', remains: 0 },
    });
  });

  it('should emit order.failed event on FAILED status', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'error' }));
    await h.pollOrderStatuses();
    const failed = h.outbox.events.find((e) => e.event.type === 'order.failed');
    expect(failed?.event.payload).toMatchObject({
      orderId: 'order-1',
      reason: 'provider-terminal',
    });
  });

  it('should emit order.partial event on PARTIAL status', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'partial', remains: 300 }));
    await h.pollOrderStatuses();
    const partial = h.outbox.events.find((e) => e.event.type === 'order.partial');
    expect(partial?.event.payload).toMatchObject({ orderId: 'order-1', remains: 300 });
  });

  it('should not emit an outbox event for non-terminal statuses', async () => {
    const h = buildHarness([makeProcessingOrder()]);
    h.stubClient.checkStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await h.pollOrderStatuses();
    expect(h.outbox.events).toHaveLength(0);
  });
});
