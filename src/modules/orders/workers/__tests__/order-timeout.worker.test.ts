import { processTimedOutOrders } from '../order-timeout.worker';
import type { OrderRecord } from '../../orders.types';

const mockFindTimedOutOrders = jest.fn();
const mockUpdateOrderStatus = jest.fn();
const mockFindProviderById = jest.fn();
const mockDecryptApiKey = jest.fn();
const mockCreateSmmApiClient = jest.fn();
const mockCheckStatus = jest.fn();
const mockSettleFunds = jest.fn();
const mockEnqueueWebhookDelivery = jest.fn();
const mockEnqueueNotification = jest.fn();

jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    polling: { orderTimeoutHours: 48 },
  }),
}));
jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest
    .fn()
    .mockReturnValue({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../../../../shared/redis/redis', () => ({
  getRedis: jest.fn().mockReturnValue({ duplicate: jest.fn() }),
}));
jest.mock('../../orders.repository', () => ({
  findTimedOutOrders: (...args: unknown[]): unknown => mockFindTimedOutOrders(...args),
  updateOrderStatus: (...args: unknown[]): unknown => mockUpdateOrderStatus(...args),
}));
jest.mock('../../../providers', () => ({
  providersRepo: {
    findProviderById: (...args: unknown[]): unknown => mockFindProviderById(...args),
  },
  decryptApiKey: (...args: unknown[]): unknown => mockDecryptApiKey(...args),
  createSmmApiClient: (...args: unknown[]): unknown => mockCreateSmmApiClient(...args),
}));
jest.mock('../../utils/stub-provider-client', () => ({
  providerClient: { checkStatus: (...args: unknown[]): unknown => mockCheckStatus(...args) },
}));
jest.mock('../../utils/fund-settlement', () => ({
  settleFunds: (...args: unknown[]): unknown => mockSettleFunds(...args),
}));
jest.mock('../../../webhooks', () => ({
  enqueueWebhookDelivery: (...args: unknown[]): unknown => mockEnqueueWebhookDelivery(...args),
}));
jest.mock('../../../notifications', () => ({
  enqueueNotification: (...args: unknown[]): unknown => mockEnqueueNotification(...args),
}));

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

describe('Order Timeout Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindTimedOutOrders.mockResolvedValue([]);
    mockUpdateOrderStatus.mockResolvedValue({});
    mockSettleFunds.mockResolvedValue(undefined);
    mockEnqueueWebhookDelivery.mockResolvedValue(undefined);
    mockEnqueueNotification.mockResolvedValue(undefined);
  });

  it('should do nothing when no timed-out orders found', async () => {
    await processTimedOutOrders();
    expect(mockFindTimedOutOrders).toHaveBeenCalledWith(48);
    expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
    expect(mockSettleFunds).not.toHaveBeenCalled();
  });

  it('should resolve timed-out order via final status check when provider returns COMPLETED', async () => {
    mockFindTimedOutOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue({ status: 'completed', remains: 0 });

    await processTimedOutOrders();

    expect(mockCheckStatus).toHaveBeenCalledWith('ext-1');
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
    );
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1', remains: 0 }),
      'COMPLETED',
    );
    // Should NOT force-fail — no webhook/notification for timeout
    expect(mockEnqueueWebhookDelivery).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it('should force-fail and release funds when final status check returns non-terminal status', async () => {
    mockFindTimedOutOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockResolvedValue({ status: 'processing', remains: 500 });

    await processTimedOutOrders();

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'FAILED', completedAt: expect.any(Date) }),
    );
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      'FAILED',
    );
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.failed',
      expect.objectContaining({ orderId: 'order-1', status: 'FAILED', reason: 'timeout' }),
    );
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'EMAIL',
        subject: 'Order Timed Out',
        eventType: 'order.failed',
        referenceType: 'order',
        referenceId: 'order-1',
      }),
    );
  });

  it('should force-fail and release funds when final status check throws an error', async () => {
    mockFindTimedOutOrders.mockResolvedValue([makeOrder()]);
    mockCheckStatus.mockRejectedValue(new Error('Provider API down'));

    await processTimedOutOrders();

    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'FAILED', completedAt: expect.any(Date) }),
    );
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      'FAILED',
    );
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.failed',
      expect.objectContaining({ orderId: 'order-1', status: 'FAILED', reason: 'timeout' }),
    );
  });

  it('should force-fail directly when order has no providerId', async () => {
    mockFindTimedOutOrders.mockResolvedValue([
      makeOrder({ providerId: null, externalOrderId: null }),
    ]);

    await processTimedOutOrders();

    // No status check attempted
    expect(mockCheckStatus).not.toHaveBeenCalled();
    expect(mockFindProviderById).not.toHaveBeenCalled();

    // Force-failed directly
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'FAILED', completedAt: expect.any(Date) }),
    );
    expect(mockSettleFunds).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      'FAILED',
    );
    expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
      'user-1',
      'order.failed',
      expect.objectContaining({ orderId: 'order-1', status: 'FAILED', reason: 'timeout' }),
    );
  });
});
