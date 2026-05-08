import { createAdminOrdersService } from '../admin-orders.service';
import { createFakeOrdersRepo, createFakeBilling, makeOrderRecord, silentLogger } from './fakes';

function build(options: { orders?: ReturnType<typeof makeOrderRecord>[] } = {}): {
  service: ReturnType<typeof createAdminOrdersService>;
  billing: ReturnType<typeof createFakeBilling>;
  ordersRepo: ReturnType<typeof createFakeOrdersRepo>;
} {
  const ordersRepo = createFakeOrdersRepo(options.orders ? { orders: options.orders } : {});
  const billing = createFakeBilling();
  const service = createAdminOrdersService({
    ordersRepo,
    billing: {
      chargeFunds: billing.chargeFunds,
      releaseFunds: billing.releaseFunds,
      refundFunds: billing.refundFunds,
    },
    logger: silentLogger,
  });
  return { service, billing, ordersRepo };
}

describe('Admin Orders Service', () => {
  describe('listAllOrders', () => {
    it('should return paginated orders', async () => {
      const { service } = build({ orders: [makeOrderRecord({ id: 'order-1' })] });

      const result = await service.listAllOrders({ page: 1, limit: 20 });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]?.orderId).toBe('order-1');
      expect(result.pagination.total).toBe(1);
    });

    it('should pass status and userId filters', async () => {
      const { service } = build({
        orders: [
          makeOrderRecord({ id: 'order-1', status: 'PENDING', userId: 'user-1' }),
          makeOrderRecord({ id: 'order-2', status: 'COMPLETED', userId: 'user-1' }),
          makeOrderRecord({ id: 'order-3', status: 'PENDING', userId: 'user-2' }),
        ],
      });

      const result = await service.listAllOrders({
        page: 1,
        limit: 20,
        status: 'PENDING',
        userId: 'user-1',
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]?.orderId).toBe('order-1');
    });

    it('should calculate totalPages correctly', async () => {
      const orders = Array.from({ length: 50 }, (_, i) =>
        makeOrderRecord({ id: `order-${i}`, userId: 'user-1' }),
      );
      const { service } = build({ orders });

      const result = await service.listAllOrders({ page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty when no orders', async () => {
      const { service } = build();

      const result = await service.listAllOrders({ page: 1, limit: 20 });

      expect(result.orders).toHaveLength(0);
    });
  });

  describe('getAnyOrder', () => {
    it('should return order detail', async () => {
      const { service } = build({
        orders: [makeOrderRecord({ id: 'order-1', userId: 'user-1' })],
      });

      const result = await service.getAnyOrder('order-1');

      expect(result.orderId).toBe('order-1');
      expect(result.userId).toBe('user-1');
    });

    it('should throw NotFoundError when order not found', async () => {
      const { service } = build();

      await expect(service.getAnyOrder('nonexistent')).rejects.toThrow('Order not found');
    });
  });

  describe('forceOrderStatus', () => {
    it('should update order status', async () => {
      const { service, ordersRepo } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING' })],
      });

      const result = await service.forceOrderStatus('order-1', 'COMPLETED');

      expect(result.status).toBe('COMPLETED');
      expect(ordersRepo.orders[0]?.status).toBe('COMPLETED');
    });

    it('should set completedAt for terminal statuses', async () => {
      const { service } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING' })],
      });

      const result = await service.forceOrderStatus('order-1', 'COMPLETED');

      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt to null for non-terminal statuses', async () => {
      const { service, ordersRepo } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING', completedAt: null })],
      });

      await service.forceOrderStatus('order-1', 'PROCESSING');

      expect(ordersRepo.orders[0]?.completedAt).toBeNull();
    });

    it('should throw NotFoundError when order not found', async () => {
      const { service } = build();

      await expect(service.forceOrderStatus('nonexistent', 'COMPLETED')).rejects.toThrow(
        'Order not found',
      );
    });

    it('should charge funds when PROCESSING → COMPLETED', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PROCESSING', price: 5.99 as never })],
      });

      await service.forceOrderStatus('order-1', 'COMPLETED');

      expect(billing.calls.chargeFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should release funds when PROCESSING → FAILED', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PROCESSING', price: 5.99 as never })],
      });

      await service.forceOrderStatus('order-1', 'FAILED');

      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should release funds when PROCESSING → CANCELLED', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PROCESSING', price: 5.99 as never })],
      });

      await service.forceOrderStatus('order-1', 'CANCELLED');

      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should release+refund funds when PROCESSING → REFUNDED', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PROCESSING', price: 5.99 as never })],
      });

      await service.forceOrderStatus('order-1', 'REFUNDED');

      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
      expect(billing.calls.refundFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should not settle finances when transitioning from non-PROCESSING status', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING' })],
      });

      await service.forceOrderStatus('order-1', 'COMPLETED');

      expect(billing.calls.chargeFunds).toHaveLength(0);
      expect(billing.calls.releaseFunds).toHaveLength(0);
    });

    it('should throw when setting same status', async () => {
      const { service } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'COMPLETED' })],
      });

      await expect(service.forceOrderStatus('order-1', 'COMPLETED')).rejects.toThrow(
        'Order already has this status',
      );
    });
  });

  describe('refundOrder', () => {
    it('should refund order and update status', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING', price: 5.99 as never })],
      });

      const result = await service.refundOrder('order-1');

      expect(result.status).toBe('REFUNDED');
      expect(billing.calls.refundFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should throw NotFoundError when order not found', async () => {
      const { service } = build();

      await expect(service.refundOrder('nonexistent')).rejects.toThrow('Order not found');
    });

    it('should throw ValidationError when already refunded', async () => {
      const { service } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'REFUNDED' })],
      });

      await expect(service.refundOrder('order-1')).rejects.toThrow('Order already refunded');
    });

    it('should release hold before refund when PROCESSING', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PROCESSING', price: 5.99 as never })],
      });

      await service.refundOrder('order-1');

      expect(billing.calls.releaseFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
      expect(billing.calls.refundFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should not release hold when refunding non-PROCESSING order', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'COMPLETED', price: 5.99 as never })],
      });

      await service.refundOrder('order-1');

      expect(billing.calls.releaseFunds).toHaveLength(0);
      expect(billing.calls.refundFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });

    it('should not release hold when refunding PENDING order', async () => {
      const { service, billing } = build({
        orders: [makeOrderRecord({ id: 'order-1', status: 'PENDING', price: 5.99 as never })],
      });

      await service.refundOrder('order-1');

      expect(billing.calls.releaseFunds).toHaveLength(0);
      expect(billing.calls.refundFunds).toEqual([
        { userId: 'user-1', amount: 5.99, orderId: 'order-1' },
      ]);
    });
  });
});
