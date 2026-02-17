import { listAllOrders, getAnyOrder, forceOrderStatus, refundOrder } from '../admin-orders.service';

const mockFindAllOrders = jest.fn();
const mockFindOrderByIdAdmin = jest.fn();
const mockUpdateOrderStatus = jest.fn();

jest.mock('../../orders/orders.repository', () => ({
  findAllOrders: (...args: unknown[]): unknown => mockFindAllOrders(...args),
  findOrderByIdAdmin: (...args: unknown[]): unknown => mockFindOrderByIdAdmin(...args),
  updateOrderStatus: (...args: unknown[]): unknown => mockUpdateOrderStatus(...args),
}));

const mockRefundFunds = jest.fn();

jest.mock('../../billing/billing-internal.service', () => ({
  refundFunds: (...args: unknown[]): unknown => mockRefundFunds(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../billing/utils/decimal', () => ({
  toNumber: (v: unknown): number => Number(v),
}));

const mockOrder = {
  id: 'order-1',
  userId: 'user-1',
  serviceId: 'svc-1',
  providerId: null,
  externalOrderId: null,
  link: 'https://youtube.com/watch?v=123',
  quantity: 1000,
  price: 5.99,
  status: 'PENDING',
  startCount: null,
  remains: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  completedAt: null,
};

describe('Admin Orders Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllOrders', () => {
    it('should return paginated orders', async () => {
      mockFindAllOrders.mockResolvedValue({ orders: [mockOrder], total: 1 });

      const result = await listAllOrders({ page: 1, limit: 20 });

      expect(result.orders).toHaveLength(1);
      const first = result.orders[0];
      expect(first?.orderId).toBe('order-1');
      expect(result.pagination.total).toBe(1);
    });

    it('should pass status and userId filters', async () => {
      mockFindAllOrders.mockResolvedValue({ orders: [], total: 0 });

      await listAllOrders({ page: 1, limit: 20, status: 'PENDING', userId: 'user-1' });

      expect(mockFindAllOrders).toHaveBeenCalledWith({
        status: 'PENDING',
        userId: 'user-1',
        page: 1,
        limit: 20,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockFindAllOrders.mockResolvedValue({ orders: [], total: 50 });

      const result = await listAllOrders({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty when no orders', async () => {
      mockFindAllOrders.mockResolvedValue({ orders: [], total: 0 });

      const result = await listAllOrders({ page: 1, limit: 20 });

      expect(result.orders).toHaveLength(0);
    });
  });

  describe('getAnyOrder', () => {
    it('should return order detail', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder);

      const result = await getAnyOrder('order-1');

      expect(result.orderId).toBe('order-1');
      expect(result.userId).toBe('user-1');
    });

    it('should throw NotFoundError when order not found', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(null);

      await expect(getAnyOrder('nonexistent')).rejects.toThrow('Order not found');
    });
  });

  describe('forceOrderStatus', () => {
    it('should update order status', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder);
      mockUpdateOrderStatus.mockResolvedValue({ ...mockOrder, status: 'COMPLETED' });

      const result = await forceOrderStatus('order-1', 'COMPLETED');

      expect(result.status).toBe('COMPLETED');
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ status: 'COMPLETED' }),
      );
    });

    it('should set completedAt for terminal statuses', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder);
      mockUpdateOrderStatus.mockResolvedValue({ ...mockOrder, status: 'COMPLETED' });

      await forceOrderStatus('order-1', 'COMPLETED');

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ completedAt: expect.any(Date) }),
      );
    });

    it('should set completedAt to null for non-terminal statuses', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder);
      mockUpdateOrderStatus.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' });

      await forceOrderStatus('order-1', 'PROCESSING');

      expect(mockUpdateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ completedAt: null }),
      );
    });

    it('should throw NotFoundError when order not found', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(null);

      await expect(forceOrderStatus('nonexistent', 'COMPLETED')).rejects.toThrow('Order not found');
    });
  });

  describe('refundOrder', () => {
    it('should refund order and update status', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder);
      mockRefundFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...mockOrder, status: 'REFUNDED' });

      const result = await refundOrder('order-1');

      expect(result.status).toBe('REFUNDED');
      expect(mockRefundFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should throw NotFoundError when order not found', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(null);

      await expect(refundOrder('nonexistent')).rejects.toThrow('Order not found');
    });

    it('should throw ValidationError when already refunded', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue({ ...mockOrder, status: 'REFUNDED' });

      await expect(refundOrder('order-1')).rejects.toThrow('Order already refunded');
    });
  });
});
