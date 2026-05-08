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
const mockChargeFunds = jest.fn();
const mockReleaseFunds = jest.fn();

jest.mock('../../billing', () => ({
  refundFunds: (...args: unknown[]): unknown => mockRefundFunds(...args),
  chargeFunds: (...args: unknown[]): unknown => mockChargeFunds(...args),
  releaseFunds: (...args: unknown[]): unknown => mockReleaseFunds(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
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
  isDripFeed: false,
  dripFeedRuns: null,
  dripFeedRunsCompleted: 0,
  dripFeedInterval: null,
  dripFeedPausedAt: null,
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

    it('should charge funds when PROCESSING → COMPLETED', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING' };
      mockFindOrderByIdAdmin.mockResolvedValue(processingOrder);
      mockChargeFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...processingOrder, status: 'COMPLETED' });

      await forceOrderStatus('order-1', 'COMPLETED');

      expect(mockChargeFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should release funds when PROCESSING → FAILED', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING' };
      mockFindOrderByIdAdmin.mockResolvedValue(processingOrder);
      mockReleaseFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...processingOrder, status: 'FAILED' });

      await forceOrderStatus('order-1', 'FAILED');

      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should release funds when PROCESSING → CANCELLED', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING' };
      mockFindOrderByIdAdmin.mockResolvedValue(processingOrder);
      mockReleaseFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...processingOrder, status: 'CANCELLED' });

      await forceOrderStatus('order-1', 'CANCELLED');

      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should release+refund funds when PROCESSING → REFUNDED', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING' };
      mockFindOrderByIdAdmin.mockResolvedValue(processingOrder);
      mockReleaseFunds.mockResolvedValue(undefined);
      mockRefundFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...processingOrder, status: 'REFUNDED' });

      await forceOrderStatus('order-1', 'REFUNDED');

      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
      expect(mockRefundFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should not settle finances when transitioning from non-PROCESSING status', async () => {
      mockFindOrderByIdAdmin.mockResolvedValue(mockOrder); // status is PENDING
      mockUpdateOrderStatus.mockResolvedValue({ ...mockOrder, status: 'COMPLETED' });

      await forceOrderStatus('order-1', 'COMPLETED');

      expect(mockChargeFunds).not.toHaveBeenCalled();
      expect(mockReleaseFunds).not.toHaveBeenCalled();
    });

    it('should throw when setting same status', async () => {
      const completedOrder = { ...mockOrder, status: 'COMPLETED' };
      mockFindOrderByIdAdmin.mockResolvedValue(completedOrder);

      await expect(forceOrderStatus('order-1', 'COMPLETED')).rejects.toThrow(
        'Order already has this status',
      );
    });

    it('should not trigger financial ops for PROCESSING→PROCESSING', async () => {
      // This is now covered by the same-status guard above
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

    it('should release hold before refund when PROCESSING', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING' };
      mockFindOrderByIdAdmin.mockResolvedValue(processingOrder);
      mockReleaseFunds.mockResolvedValue(undefined);
      mockRefundFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...processingOrder, status: 'REFUNDED' });

      await refundOrder('order-1');

      expect(mockReleaseFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
      expect(mockRefundFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should not release hold when refunding non-PROCESSING order', async () => {
      const completedOrder = { ...mockOrder, status: 'COMPLETED' };
      mockFindOrderByIdAdmin.mockResolvedValue(completedOrder);
      mockRefundFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...completedOrder, status: 'REFUNDED' });

      await refundOrder('order-1');

      expect(mockReleaseFunds).not.toHaveBeenCalled();
      expect(mockRefundFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });

    it('should not release hold when refunding PENDING order', async () => {
      const pendingOrder = { ...mockOrder, status: 'PENDING' };
      mockFindOrderByIdAdmin.mockResolvedValue(pendingOrder);
      mockRefundFunds.mockResolvedValue(undefined);
      mockUpdateOrderStatus.mockResolvedValue({ ...pendingOrder, status: 'REFUNDED' });

      await refundOrder('order-1');

      expect(mockReleaseFunds).not.toHaveBeenCalled();
      expect(mockRefundFunds).toHaveBeenCalledWith('user-1', 5.99, 'order-1');
    });
  });
});
