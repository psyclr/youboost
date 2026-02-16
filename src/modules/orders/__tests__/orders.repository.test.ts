import { createOrder, findOrderById, findOrders, updateOrderStatus } from '../orders.repository';

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    order: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

const mockOrder = {
  id: 'order-1',
  userId: 'user-1',
  serviceId: 'svc-1',
  providerId: null,
  externalOrderId: null,
  link: 'https://youtube.com/watch?v=test',
  quantity: 1000,
  price: 2.5,
  status: 'PENDING',
  startCount: null,
  remains: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
};

describe('Orders Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      mockCreate.mockResolvedValue(mockOrder);

      const result = await createOrder({
        userId: 'user-1',
        serviceId: 'svc-1',
        link: 'https://youtube.com/watch?v=test',
        quantity: 1000,
        price: 2.5,
      });

      expect(result).toEqual(mockOrder);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          serviceId: 'svc-1',
          link: 'https://youtube.com/watch?v=test',
          quantity: 1000,
          price: 2.5,
        },
      });
    });
  });

  describe('findOrderById', () => {
    it('should find order scoped by userId', async () => {
      mockFindFirst.mockResolvedValue(mockOrder);

      const result = await findOrderById('order-1', 'user-1');

      expect(result).toEqual(mockOrder);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findOrderById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findOrders', () => {
    it('should return paginated orders', async () => {
      mockFindMany.mockResolvedValue([mockOrder]);
      mockCount.mockResolvedValue(1);

      const result = await findOrders('user-1', { page: 1, limit: 20 });

      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findOrders('user-1', { page: 1, limit: 20, status: 'PENDING' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'PENDING' },
        }),
      );
    });

    it('should filter by serviceId', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findOrders('user-1', { page: 1, limit: 20, serviceId: 'svc-1' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', serviceId: 'svc-1' },
        }),
      );
    });

    it('should apply correct pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findOrders('user-1', { page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should order by createdAt desc', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findOrders('user-1', { page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      mockUpdate.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' });

      const result = await updateOrderStatus('order-1', { status: 'PROCESSING' });

      expect(result.status).toBe('PROCESSING');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      });
    });

    it('should update with completedAt', async () => {
      const completedAt = new Date();
      mockUpdate.mockResolvedValue({ ...mockOrder, status: 'COMPLETED', completedAt });

      await updateOrderStatus('order-1', { status: 'COMPLETED', completedAt });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'COMPLETED', completedAt }),
      });
    });
  });
});
