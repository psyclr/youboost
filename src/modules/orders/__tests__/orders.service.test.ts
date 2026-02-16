import { createOrder, getOrder, listOrders, cancelOrder } from '../orders.service';

const mockFindServiceById = jest.fn();
jest.mock('../service.repository', () => ({
  findServiceById: (...args: unknown[]): unknown => mockFindServiceById(...args),
}));

const mockCreateOrder = jest.fn();
const mockFindOrderById = jest.fn();
const mockFindOrders = jest.fn();
const mockUpdateOrderStatus = jest.fn();
jest.mock('../orders.repository', () => ({
  createOrder: (...args: unknown[]): unknown => mockCreateOrder(...args),
  findOrderById: (...args: unknown[]): unknown => mockFindOrderById(...args),
  findOrders: (...args: unknown[]): unknown => mockFindOrders(...args),
  updateOrderStatus: (...args: unknown[]): unknown => mockUpdateOrderStatus(...args),
}));

const mockHoldFunds = jest.fn();
const mockReleaseFunds = jest.fn();
jest.mock('../../billing', () => ({
  holdFunds: (...args: unknown[]): unknown => mockHoldFunds(...args),
  releaseFunds: (...args: unknown[]): unknown => mockReleaseFunds(...args),
}));

const mockSubmitOrder = jest.fn();
const mockSelectProvider = jest.fn();
jest.mock('../../providers', () => ({
  selectProvider: (...args: unknown[]): unknown => mockSelectProvider(...args),
}));

const mockEnqueueWebhookDelivery = jest.fn();
jest.mock('../../webhooks', () => ({
  enqueueWebhookDelivery: (...args: unknown[]): unknown => mockEnqueueWebhookDelivery(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockService = {
  id: 'svc-1',
  name: 'YouTube Views',
  platform: 'YOUTUBE',
  type: 'VIEWS',
  pricePer1000: 2.5,
  minQuantity: 100,
  maxQuantity: 100_000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOrder = {
  id: 'order-1',
  userId: 'user-1',
  serviceId: 'svc-1',
  providerId: null,
  externalOrderId: 'ext-1',
  link: 'https://youtube.com/watch?v=test',
  quantity: 1000,
  price: 2.5,
  status: 'PROCESSING',
  startCount: null,
  remains: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
};

function setupCreateOrder(): void {
  mockFindServiceById.mockResolvedValue(mockService);
  mockCreateOrder.mockResolvedValue({ ...mockOrder, status: 'PENDING' });
  mockHoldFunds.mockResolvedValue(undefined);
  mockSubmitOrder.mockResolvedValue({ externalOrderId: 'ext-1', status: 'processing' });
  mockUpdateOrderStatus.mockResolvedValue(mockOrder);
}

describe('Orders Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueWebhookDelivery.mockResolvedValue(undefined);
    mockSelectProvider.mockResolvedValue({
      providerId: 'stub',
      client: { submitOrder: mockSubmitOrder, checkStatus: jest.fn() },
    });
  });

  describe('createOrder', () => {
    const input = { serviceId: 'svc-1', link: 'https://youtube.com/watch?v=test', quantity: 1000 };

    it('should create order and hold funds', async () => {
      setupCreateOrder();
      const result = await createOrder('user-1', input);
      expect(result.orderId).toBe('order-1');
      expect(result.status).toBe('PROCESSING');
      expect(mockHoldFunds).toHaveBeenCalledWith('user-1', 2.5, 'order-1');
    });

    it('should calculate price correctly', async () => {
      mockFindServiceById.mockResolvedValue({ ...mockService, pricePer1000: 5 });
      mockCreateOrder.mockResolvedValue({ ...mockOrder, id: 'o2' });
      mockHoldFunds.mockResolvedValue(undefined);
      mockSubmitOrder.mockResolvedValue({ externalOrderId: 'e2', status: 'ok' });
      mockUpdateOrderStatus.mockResolvedValue(mockOrder);
      await createOrder('user-1', { ...input, quantity: 5000 });
      expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ price: 25 }));
    });

    it('should throw NotFoundError if service not found', async () => {
      mockFindServiceById.mockResolvedValue(null);
      await expect(createOrder('user-1', input)).rejects.toThrow('Service not found');
    });

    it('should throw ValidationError if service inactive', async () => {
      mockFindServiceById.mockResolvedValue({ ...mockService, isActive: false });
      await expect(createOrder('user-1', input)).rejects.toThrow('Service is not available');
    });

    it('should throw ValidationError if quantity below minimum', async () => {
      mockFindServiceById.mockResolvedValue(mockService);
      await expect(createOrder('user-1', { ...input, quantity: 50 })).rejects.toThrow(
        'Quantity must be between',
      );
    });

    it('should throw ValidationError if quantity above maximum', async () => {
      mockFindServiceById.mockResolvedValue(mockService);
      await expect(createOrder('user-1', { ...input, quantity: 200_000 })).rejects.toThrow(
        'Quantity must be between',
      );
    });

    it('should submit to provider after creating order', async () => {
      setupCreateOrder();
      await createOrder('user-1', input);
      expect(mockSubmitOrder).toHaveBeenCalledWith({
        serviceId: 'svc-1',
        link: 'https://youtube.com/watch?v=test',
        quantity: 1000,
      });
    });

    it('should dispatch order.created webhook event', async () => {
      setupCreateOrder();
      await createOrder('user-1', input);
      expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
        'user-1',
        'order.created',
        expect.objectContaining({ orderId: 'order-1' }),
      );
    });

    it('should not fail if webhook dispatch throws', async () => {
      setupCreateOrder();
      mockEnqueueWebhookDelivery.mockRejectedValue(new Error('webhook error'));
      const result = await createOrder('user-1', input);
      expect(result.orderId).toBe('order-1');
    });

    it('should update order with externalOrderId and PROCESSING status', async () => {
      mockFindServiceById.mockResolvedValue(mockService);
      mockCreateOrder.mockResolvedValue({ ...mockOrder, id: 'o3', status: 'PENDING' });
      mockHoldFunds.mockResolvedValue(undefined);
      mockSubmitOrder.mockResolvedValue({ externalOrderId: 'ext-99', status: 'ok' });
      mockUpdateOrderStatus.mockResolvedValue(mockOrder);
      await createOrder('user-1', input);
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith('o3', {
        status: 'PROCESSING',
        externalOrderId: 'ext-99',
        providerId: 'stub',
        remains: 1000,
      });
    });
  });

  describe('getOrder', () => {
    it('should return order details', async () => {
      mockFindOrderById.mockResolvedValue(mockOrder);
      const result = await getOrder('user-1', 'order-1');
      expect(result.orderId).toBe('order-1');
      expect(result.link).toBe('https://youtube.com/watch?v=test');
    });

    it('should throw NotFoundError if order not found', async () => {
      mockFindOrderById.mockResolvedValue(null);
      await expect(getOrder('user-1', 'bad-id')).rejects.toThrow('Order not found');
    });

    it('should scope by userId', async () => {
      mockFindOrderById.mockResolvedValue(mockOrder);
      await getOrder('user-1', 'order-1');
      expect(mockFindOrderById).toHaveBeenCalledWith('order-1', 'user-1');
    });
  });

  describe('listOrders', () => {
    it('should return paginated orders', async () => {
      mockFindOrders.mockResolvedValue({ orders: [mockOrder], total: 1 });
      const result = await listOrders('user-1', { page: 1, limit: 20 });
      expect(result.orders).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass filters to repository', async () => {
      mockFindOrders.mockResolvedValue({ orders: [], total: 0 });
      await listOrders('user-1', { page: 2, limit: 10, status: 'PENDING', serviceId: 'svc-1' });
      expect(mockFindOrders).toHaveBeenCalledWith('user-1', {
        status: 'PENDING',
        serviceId: 'svc-1',
        page: 2,
        limit: 10,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockFindOrders.mockResolvedValue({ orders: [], total: 45 });
      const result = await listOrders('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty orders array when none found', async () => {
      mockFindOrders.mockResolvedValue({ orders: [], total: 0 });
      const result = await listOrders('user-1', { page: 1, limit: 20 });
      expect(result.orders).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('cancelOrder', () => {
    function setupCancel(): void {
      mockFindOrderById.mockResolvedValue({ ...mockOrder, status: 'PENDING' });
      mockReleaseFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        completedAt: new Date(),
      });
    }

    it('should cancel PENDING order and release funds', async () => {
      setupCancel();
      const result = await cancelOrder('user-1', 'order-1');
      expect(result.status).toBe('CANCELLED');
      expect(result.refundAmount).toBe(2.5);
      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 2.5, 'order-1');
    });

    it('should cancel PROCESSING order', async () => {
      mockFindOrderById.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' });
      mockReleaseFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
        completedAt: new Date(),
      });
      const result = await cancelOrder('user-1', 'order-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw NotFoundError if order not found', async () => {
      mockFindOrderById.mockResolvedValue(null);
      await expect(cancelOrder('user-1', 'bad-id')).rejects.toThrow('Order not found');
    });

    it('should throw ValidationError if order is COMPLETED', async () => {
      mockFindOrderById.mockResolvedValue({ ...mockOrder, status: 'COMPLETED' });
      await expect(cancelOrder('user-1', 'order-1')).rejects.toThrow('Order cannot be cancelled');
    });

    it('should throw ValidationError if order is already CANCELLED', async () => {
      mockFindOrderById.mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });
      await expect(cancelOrder('user-1', 'order-1')).rejects.toThrow('Order cannot be cancelled');
    });

    it('should dispatch order.cancelled webhook event', async () => {
      setupCancel();
      await cancelOrder('user-1', 'order-1');
      expect(mockEnqueueWebhookDelivery).toHaveBeenCalledWith(
        'user-1',
        'order.cancelled',
        expect.objectContaining({ orderId: 'order-1' }),
      );
    });

    it('should not fail cancel if webhook dispatch throws', async () => {
      setupCancel();
      mockEnqueueWebhookDelivery.mockRejectedValue(new Error('fail'));
      const result = await cancelOrder('user-1', 'order-1');
      expect(result.status).toBe('CANCELLED');
    });
  });
});
