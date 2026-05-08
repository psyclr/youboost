import { createOrdersRepository } from '../orders.repository';
import type { PrismaClient } from '../../../generated/prisma';

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();

const fakePrisma = {
  order: {
    create: (...args: unknown[]): unknown => mockCreate(...args),
    findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
    findUnique: (...args: unknown[]): unknown => mockFindUnique(...args),
    findMany: (...args: unknown[]): unknown => mockFindMany(...args),
    count: (...args: unknown[]): unknown => mockCount(...args),
    update: (...args: unknown[]): unknown => mockUpdate(...args),
  },
} as unknown as PrismaClient;

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

describe('Orders Repository (factory)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      mockCreate.mockResolvedValue(mockOrder);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.createOrder({
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
          isDripFeed: false,
          dripFeedRuns: null,
          dripFeedInterval: null,
          dripFeedRunsCompleted: 0,
        },
      });
    });
  });

  describe('findOrderById', () => {
    it('should find order scoped by userId', async () => {
      mockFindFirst.mockResolvedValue(mockOrder);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findOrderById('order-1', 'user-1');

      expect(result).toEqual(mockOrder);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findOrderById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findOrders', () => {
    it('should return paginated orders', async () => {
      mockFindMany.mockResolvedValue([mockOrder]);
      mockCount.mockResolvedValue(1);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findOrders('user-1', { page: 1, limit: 20 });

      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const repo = createOrdersRepository(fakePrisma);
      await repo.findOrders('user-1', { page: 1, limit: 20, status: 'PENDING' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'PENDING' },
        }),
      );
    });

    it('should filter by serviceId', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const repo = createOrdersRepository(fakePrisma);
      await repo.findOrders('user-1', { page: 1, limit: 20, serviceId: 'svc-1' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', serviceId: 'svc-1' },
        }),
      );
    });

    it('should apply correct pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const repo = createOrdersRepository(fakePrisma);
      await repo.findOrders('user-1', { page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('should order by createdAt desc', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const repo = createOrdersRepository(fakePrisma);
      await repo.findOrders('user-1', { page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findProcessingOrders', () => {
    it('should query orders with PROCESSING status and non-null externalOrderId', async () => {
      const processingOrder = { ...mockOrder, status: 'PROCESSING', externalOrderId: 'ext-1' };
      mockFindMany.mockResolvedValue([processingOrder]);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findProcessingOrders(100);

      expect(result).toEqual([processingOrder]);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { status: 'PROCESSING', externalOrderId: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
    });

    it('should return empty array when no processing orders exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findProcessingOrders(50);

      expect(result).toEqual([]);
    });

    it('should respect batchSize parameter', async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createOrdersRepository(fakePrisma);
      await repo.findProcessingOrders(25);

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      mockUpdate.mockResolvedValue({ ...mockOrder, status: 'PROCESSING' });

      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.updateOrderStatus('order-1', { status: 'PROCESSING' });

      expect(result.status).toBe('PROCESSING');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'PROCESSING' }),
      });
    });

    it('should update with completedAt', async () => {
      const completedAt = new Date();
      mockUpdate.mockResolvedValue({ ...mockOrder, status: 'COMPLETED', completedAt });
      const repo = createOrdersRepository(fakePrisma);
      await repo.updateOrderStatus('order-1', { status: 'COMPLETED', completedAt });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'COMPLETED', completedAt }),
      });
    });
  });

  describe('findAllOrders', () => {
    it('should return paginated orders without userId filter', async () => {
      mockFindMany.mockResolvedValue([mockOrder]);
      mockCount.mockResolvedValue(1);
      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findAllOrders({ page: 1, limit: 20 });
      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status and userId', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      const repo = createOrdersRepository(fakePrisma);
      await repo.findAllOrders({ page: 1, limit: 20, status: 'COMPLETED', userId: 'user-1' });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'COMPLETED', userId: 'user-1' } }),
      );
    });

    it('should apply pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      const repo = createOrdersRepository(fakePrisma);
      await repo.findAllOrders({ page: 3, limit: 10 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('findOrderByIdAdmin', () => {
    it('should find order without userId constraint', async () => {
      mockFindUnique.mockResolvedValue(mockOrder);
      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findOrderByIdAdmin('order-1');
      expect(result).toEqual(mockOrder);
    });

    it('should return null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const repo = createOrdersRepository(fakePrisma);
      const result = await repo.findOrderByIdAdmin('nonexistent');
      expect(result).toBeNull();
    });
  });
});
