import { createStatusPollWorker, createDripFeedWorker, createOrderTimeoutWorker } from '../index';
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
} from '../../__tests__/fakes';

const mockStartNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockStopNamedWorker = jest.fn().mockResolvedValue(undefined);
const mockQueueAdd = jest.fn().mockResolvedValue({});
const mockGetNamedQueue = jest.fn().mockReturnValue({ add: mockQueueAdd });

jest.mock('../../../../shared/queue', () => ({
  startNamedWorker: (...args: unknown[]): unknown => mockStartNamedWorker(...args),
  stopNamedWorker: (...args: unknown[]): unknown => mockStopNamedWorker(...args),
  getNamedQueue: (...args: unknown[]): unknown => mockGetNamedQueue(...args),
}));

function buildStatusPollWorker(): ReturnType<typeof createStatusPollWorker> {
  const prisma = createFakePrisma();
  return createStatusPollWorker({
    prisma: prisma.client,
    ordersRepo: createFakeOrdersRepository(),
    servicesRepo: createFakeServicesRepository(),
    providerSelector: createFakeProviderSelector({ client: createFakeProviderClient() }),
    stubClient: createFakeProviderClient(),
    fundSettlement: createFakeFundSettlement(),
    circuitBreaker: createFakeCircuitBreaker(),
    outbox: createFakeOutbox().port,
    config: {
      intervalMs: 30_000,
      batchSize: 100,
      circuitBreakerThreshold: 5,
      circuitBreakerCooldownMs: 60_000,
    },
    logger: silentLogger,
  });
}

function buildOrderTimeoutWorker(): ReturnType<typeof createOrderTimeoutWorker> {
  const prisma = createFakePrisma();
  return createOrderTimeoutWorker({
    prisma: prisma.client,
    ordersRepo: createFakeOrdersRepository(),
    providerSelector: createFakeProviderSelector({ client: createFakeProviderClient() }),
    stubClient: createFakeProviderClient(),
    fundSettlement: createFakeFundSettlement(),
    outbox: createFakeOutbox().port,
    config: { orderTimeoutHours: 48 },
    logger: silentLogger,
  });
}

function buildDripFeedWorker(): ReturnType<typeof createDripFeedWorker> {
  return createDripFeedWorker({
    ordersRepo: createFakeOrdersRepository(),
    servicesRepo: createFakeServicesRepository(),
    providerSelector: createFakeProviderSelector({ client: createFakeProviderClient() }),
    ordersService: { setRefillEligibility: jest.fn().mockResolvedValue(undefined) },
    logger: silentLogger,
  });
}

describe('Orders Workers — lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('statusPollWorker', () => {
    it('should start a named worker and schedule a repeating job', async () => {
      const worker = buildStatusPollWorker();
      await worker.start();

      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'order-polling',
        expect.any(Function),
        expect.objectContaining({ retryable: false, concurrency: 1 }),
      );
      expect(mockGetNamedQueue).toHaveBeenCalledWith('order-polling');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'poll-order-statuses',
        {},
        { repeat: { every: 30_000 } },
      );
    });

    it('should stop the named worker', async () => {
      const worker = buildStatusPollWorker();
      await worker.stop();
      expect(mockStopNamedWorker).toHaveBeenCalledWith('order-polling');
    });
  });

  describe('orderTimeoutWorker', () => {
    it('should start a named worker on the order-timeout queue', async () => {
      const worker = buildOrderTimeoutWorker();
      await worker.start();
      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'order-timeout',
        expect.any(Function),
        expect.objectContaining({ retryable: false, concurrency: 1 }),
      );
    });

    it('should stop the named worker', async () => {
      const worker = buildOrderTimeoutWorker();
      await worker.stop();
      expect(mockStopNamedWorker).toHaveBeenCalledWith('order-timeout');
    });
  });

  describe('dripFeedWorker', () => {
    it('should start a retryable named worker on the drip-feed queue', async () => {
      const worker = buildDripFeedWorker();
      await worker.start();
      expect(mockStartNamedWorker).toHaveBeenCalledWith(
        'drip-feed',
        expect.any(Function),
        expect.objectContaining({ retryable: true, concurrency: 1 }),
      );
    });

    it('should stop the named worker', async () => {
      const worker = buildDripFeedWorker();
      await worker.stop();
      expect(mockStopNamedWorker).toHaveBeenCalledWith('drip-feed');
    });
  });
});
