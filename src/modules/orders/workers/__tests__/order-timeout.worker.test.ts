import { createOrderTimeoutWorker } from '../order-timeout.worker';
import type { OrderRecord } from '../../orders.types';
import {
  createFakeOrdersRepository,
  createFakeFundSettlement,
  createFakeOutbox,
  createFakePrisma,
  createFakeProviderClient,
  createFakeProviderSelector,
  silentLogger,
  makeOrderRecord,
  type FakeOrdersRepository,
} from '../../__tests__/fakes';

function makeTimedOutOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return makeOrderRecord({
    status: 'PROCESSING',
    providerId: 'stub',
    externalOrderId: 'ext-1',
    price: 10.0 as unknown as OrderRecord['price'],
    ...overrides,
  });
}

interface Harness {
  processTimedOutOrders: () => Promise<void>;
  ordersRepo: FakeOrdersRepository;
  outbox: ReturnType<typeof createFakeOutbox>;
  fundSettlement: ReturnType<typeof createFakeFundSettlement>;
  stubClient: ReturnType<typeof createFakeProviderClient>;
}

function buildHarness(initialOrders: OrderRecord[] = []): Harness {
  const ordersRepo = createFakeOrdersRepository({ orders: initialOrders });
  const outbox = createFakeOutbox();
  const fundSettlement = createFakeFundSettlement();
  const prisma = createFakePrisma();
  const stubClient = createFakeProviderClient();
  const providerSelector = createFakeProviderSelector({
    client: createFakeProviderClient(),
    providerId: 'prov-1',
  });

  // Override findTimedOutOrders to return whatever we seeded directly — the
  // fake's cutoff logic depends on wall clock, which is awkward for unit tests.
  ordersRepo.findTimedOutOrders = jest.fn(async () => initialOrders);

  const worker = createOrderTimeoutWorker({
    prisma: prisma.client,
    ordersRepo,
    providerSelector,
    stubClient,
    fundSettlement,
    outbox: outbox.port,
    config: { orderTimeoutHours: 48 },
    logger: silentLogger,
  });

  return {
    processTimedOutOrders: worker.processTimedOutOrders,
    ordersRepo,
    outbox,
    fundSettlement,
    stubClient,
  };
}

describe('Order Timeout Worker (factory)', () => {
  it('should do nothing when no timed-out orders found', async () => {
    const h = buildHarness();
    await h.processTimedOutOrders();
    expect(h.ordersRepo.calls.updateOrderStatus).toHaveLength(0);
    expect(h.fundSettlement.calls.settleFunds).toHaveLength(0);
  });

  it('should resolve timed-out order via final status check when provider returns COMPLETED', async () => {
    const h = buildHarness([makeTimedOutOrder()]);
    h.stubClient.checkStatus.mockResolvedValue({
      status: 'completed',
      startCount: 100,
      completed: 1000,
      remains: 0,
    });

    await h.processTimedOutOrders();

    expect(h.stubClient.checkStatus).toHaveBeenCalledWith('ext-1');
    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data).toMatchObject({
      status: 'COMPLETED',
    });
    expect(h.fundSettlement.calls.settleFunds[0]).toMatchObject({
      order: expect.objectContaining({ id: 'order-1', remains: 0 }),
      status: 'COMPLETED',
    });

    const completed = h.outbox.events.find((e) => e.event.type === 'order.completed');
    expect(completed?.event.payload).toMatchObject({ orderId: 'order-1', remains: 0 });
  });

  it('should force-fail and release funds when final status check returns non-terminal status', async () => {
    const h = buildHarness([makeTimedOutOrder()]);
    h.stubClient.checkStatus.mockResolvedValue({
      status: 'processing',
      startCount: 0,
      completed: 0,
      remains: 500,
    });

    await h.processTimedOutOrders();

    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data.status).toBe('FAILED');
    expect(h.fundSettlement.calls.settleFunds[0]).toMatchObject({
      order: expect.objectContaining({ id: 'order-1' }),
      status: 'FAILED',
    });

    const failed = h.outbox.events.find((e) => e.event.type === 'order.failed');
    expect(failed?.event.payload).toMatchObject({
      orderId: 'order-1',
      userId: 'user-1',
      reason: 'timeout',
    });
  });

  it('should force-fail and release funds when final status check throws an error', async () => {
    const h = buildHarness([makeTimedOutOrder()]);
    h.stubClient.checkStatus.mockRejectedValue(new Error('Provider API down'));

    await h.processTimedOutOrders();

    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data.status).toBe('FAILED');
    expect(h.fundSettlement.calls.settleFunds[0]?.status).toBe('FAILED');

    const failed = h.outbox.events.find((e) => e.event.type === 'order.failed');
    expect(failed?.event.payload).toMatchObject({ reason: 'timeout' });
  });

  it('should force-fail directly when order has no providerId', async () => {
    const h = buildHarness([makeTimedOutOrder({ providerId: null, externalOrderId: null })]);

    await h.processTimedOutOrders();

    expect(h.stubClient.checkStatus).not.toHaveBeenCalled();
    expect(h.ordersRepo.calls.updateOrderStatus[0]?.data.status).toBe('FAILED');
    expect(h.fundSettlement.calls.settleFunds[0]?.status).toBe('FAILED');

    const failed = h.outbox.events.find((e) => e.event.type === 'order.failed');
    expect(failed?.event.payload).toMatchObject({ reason: 'timeout' });
  });
});
