import { pollOrderStatuses } from '../status-poll.worker';
import type { OrderRecord } from '../../orders.types';
import type { StatusResult } from '../../utils/provider-client';

const mockFindProcessingOrders = jest.fn();
const mockUpdateOrderStatus = jest.fn();
const mockFindProviderById = jest.fn();
const mockDecryptApiKey = jest.fn();
const mockCreateSmmApiClient = jest.fn();
const mockCheckStatus = jest.fn();
const mockSettleFunds = jest.fn();

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    polling: { batchSize: 100, circuitBreakerThreshold: 5, circuitBreakerCooldownMs: 60_000 },
  }),
}));
jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
jest.mock('../../orders.repository', () => ({
  findProcessingOrders: (...args: unknown[]): unknown => mockFindProcessingOrders(...args),
  updateOrderStatus: (...args: unknown[]): unknown => mockUpdateOrderStatus(...args),
}));
jest.mock('../../../providers/providers.repository', () => ({
  findProviderById: (...args: unknown[]): unknown => mockFindProviderById(...args),
}));
jest.mock('../../../providers/utils/encryption', () => ({
  decryptApiKey: (...args: unknown[]): unknown => mockDecryptApiKey(...args),
}));
jest.mock('../../../providers/utils/smm-api-client', () => ({
  createSmmApiClient: (...args: unknown[]): unknown => mockCreateSmmApiClient(...args),
}));
jest.mock('../../utils/stub-provider-client', () => ({
  providerClient: { checkStatus: (...args: unknown[]): unknown => mockCheckStatus(...args) },
}));
jest.mock('../../utils/circuit-breaker', () => ({
  isCircuitOpen: jest.fn().mockReturnValue(false),
  recordFailure: jest.fn(),
  recordSuccess: jest.fn(),
}));
const mockEnqueueWebhookDelivery = jest.fn();

jest.mock('../../../webhooks', () => ({
  enqueueWebhookDelivery: (...args: unknown[]): unknown => mockEnqueueWebhookDelivery(...args),
}));
jest.mock('../../utils/fund-settlement', () => ({
  settleFunds: (...args: unknown[]): unknown => mockSettleFunds(...args),
}));

const { isCircuitOpen, recordFailure, recordSuccess } = jest.requireMock<
  typeof import('../../utils/circuit-breaker')
>('../../utils/circuit-breaker');

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'order-1',
    userId: 'user-1',
    serviceId: 'svc-1',
    providerId: 'stub',
    externalOrderId: 'ext-1',
    link: 'https://youtube.com/watch?v=test',
    quantity: 1000,
    price: 10.0 as unknown as OrderRecord['price'],
    status: 'PROCESSING',
    startCount: null,
    remains: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

function makeStatus(overrides: Partial<StatusResult> = {}): StatusResult {
  return { status: 'completed', startCount: 100, completed: 1000, remains: 0, ...overrides };
}

describe('Status Poll Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindProcessingOrders.mockResolvedValue([]);
    mockUpdateOrderStatus.mockResolvedValue({});
    mockSettleFunds.mockResolvedValue(undefined);
    mockEnqueueWebhookDelivery.mockResolvedValue(undefined);
    (isCircuitOpen as jest.Mock).mockReturnValue(false);
  });

  it('should do nothing when no processing orders', async () => {
    await pollOrderStatuses();
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
  });

  it('should poll status for stub provider orders', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'completed' }));
    await pollOrderStatuses();
    expect(mockCheckStatus).toHaveBeenCalledWith('ext-1');
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });

  it('should settle funds on terminal status', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'completed', remains: 0 }));
    await pollOrderStatuses();
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', remains: 0 }),
      'COMPLETED',
    );
  });

  it('should not settle funds on non-terminal status', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await pollOrderStatuses();
    expect(mockSettleFunds).not.toHaveBeenCalled();
  });

  it('should skip update when status unchanged and non-terminal', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ status: 'PROCESSING' })]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await pollOrderStatuses();
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
  });

  it('should skip providers with open circuit breaker', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ providerId: 'provider-1' })]);
    (isCircuitOpen as jest.Mock).mockReturnValue(true);
    await pollOrderStatuses();
    expect(mockCheckStatus).not.toHaveBeenCalled();
  });

  it('should record success on successful poll', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await pollOrderStatuses();
    expect(recordSuccess).toHaveBeenCalledWith('stub');
  });

  it('should record failure on poll error', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockRejectedValue(new Error('Provider error'));
    await pollOrderStatuses();
    expect(recordFailure).toHaveBeenCalledWith('stub');
  });

  it('should continue processing other orders after individual failure', async () => {
    const order1 = makeOrder({ id: 'order-1', externalOrderId: 'ext-1' });
    const order2 = makeOrder({ id: 'order-2', externalOrderId: 'ext-2' });
    mockFindProcessingOrders.mockResolvedValue([order1, order2]);
    mockCheckStatus
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeStatus({ status: 'completed' }));
    await pollOrderStatuses();
    expect(mockCheckStatus).toHaveBeenCalledTimes(2);
    expect(mockUpdateOrderStatus).toHaveBeenCalledTimes(1);
  });

  it('should group orders by providerId', async () => {
    const order1 = makeOrder({ id: 'o1', providerId: 'stub' });
    const order2 = makeOrder({ id: 'o2', providerId: 'provider-2' });
    mockFindProcessingOrders.mockResolvedValue([order1, order2]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    mockFindProviderById.mockResolvedValue({
      id: 'provider-2',
      apiEndpoint: 'https://api.test.com',
      apiKeyEncrypted: 'encrypted-key',
    });
    mockDecryptApiKey.mockReturnValue('decrypted-key');
    const realClient = {
      checkStatus: jest.fn().mockResolvedValue(makeStatus({ status: 'processing' })),
    };
    mockCreateSmmApiClient.mockReturnValue(realClient);
    await pollOrderStatuses();
    expect(mockCheckStatus).toHaveBeenCalledTimes(1);
    expect(realClient.checkStatus).toHaveBeenCalledTimes(1);
  });

  it('should resolve real provider client via decryption', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ providerId: 'real-provider' })]);
    mockFindProviderById.mockResolvedValue({
      id: 'real-provider',
      apiEndpoint: 'https://smm.api.com',
      apiKeyEncrypted: 'encrypted',
    });
    mockDecryptApiKey.mockReturnValue('api-key-123');
    const client = {
      checkStatus: jest.fn().mockResolvedValue(makeStatus({ status: 'processing' })),
    };
    mockCreateSmmApiClient.mockReturnValue(client);
    await pollOrderStatuses();
    expect(mockDecryptApiKey).toHaveBeenCalledWith('encrypted');
    expect(mockCreateSmmApiClient).toHaveBeenCalledWith({
      apiEndpoint: 'https://smm.api.com',
      apiKey: 'api-key-123',
    });
  });

  it('should record failure when provider not found', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ providerId: 'missing-provider' })]);
    mockFindProviderById.mockResolvedValue(null);
    await pollOrderStatuses();
    expect(recordFailure).toHaveBeenCalledWith('missing-provider');
  });

  it('should set completedAt for terminal statuses', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'completed' }));
    await pollOrderStatuses();
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ completedAt: expect.any(Date) }),
    );
  });

  it('should handle orders with null providerId as stub', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ providerId: null })]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await pollOrderStatuses();
    expect(mockCheckStatus).toHaveBeenCalled();
  });

  it('should update startCount and remains from provider response', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(
      makeStatus({ status: 'partial', startCount: 500, remains: 200 }),
    );
    await pollOrderStatuses();
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        status: 'PARTIAL',
        startCount: 500,
        remains: 200,
      }),
    );
  });

  it('should pass updated remains to settleFunds for partial orders', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder({ quantity: 1000 })]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'partial', remains: 300 }));
    await pollOrderStatuses();
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ remains: 300 }),
      'PARTIAL',
    );
  });

  it('should use batchSize from config', async () => {
    await pollOrderStatuses();
    expect(mockFindProcessingOrders).toHaveBeenCalledWith(100);
  });

  it('should dispatch order.completed webhook on COMPLETED status', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'completed', remains: 0 }));
    await pollOrderStatuses();
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.completed',
      expect.objectContaining({ orderId: 'order-1', status: 'COMPLETED' }),
    );
  });

  it('should dispatch order.failed webhook on FAILED status', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'error' }));
    await pollOrderStatuses();
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.failed',
      expect.objectContaining({ orderId: 'order-1', status: 'FAILED' }),
    );
  });

  it('should dispatch order.partial webhook on PARTIAL status', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'partial', remains: 300 }));
    await pollOrderStatuses();
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.partial',
      expect.objectContaining({ orderId: 'order-1', status: 'PARTIAL', remains: 300 }),
    );
  });

  it('should not dispatch webhook for non-terminal statuses', async () => {
    mockFindProcessingOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue(makeStatus({ status: 'processing' }));
    await pollOrderStatuses();
    expect(mockEnqueueWebhookDelivery).not.toHaveBeenCalled();
  });
});
