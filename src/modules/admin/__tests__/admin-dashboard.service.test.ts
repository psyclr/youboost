import { getDashboardStats } from '../admin-dashboard.service';

const mockCount = jest.fn();
const mockAggregate = jest.fn();
const mockFindMany = jest.fn();

const mockPrisma = {
  user: { count: (...args: unknown[]): unknown => mockCount(...args) },
  order: {
    count: (...args: unknown[]): unknown => mockCount(...args),
    aggregate: (...args: unknown[]): unknown => mockAggregate(...args),
    findMany: (...args: unknown[]): unknown => mockFindMany(...args),
  },
  service: { count: (...args: unknown[]): unknown => mockCount(...args) },
};

jest.mock('../../../shared/database', () => ({
  getPrisma: (): unknown => mockPrisma,
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

const mockOrderRecord = {
  id: 'order-1',
  userId: 'user-1',
  serviceId: 'svc-1',
  link: 'https://youtube.com/watch?v=123',
  quantity: 1000,
  price: 5.99,
  status: 'COMPLETED',
  startCount: null,
  remains: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  completedAt: new Date('2024-01-02'),
};

describe('Admin Dashboard Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard stats', async () => {
      // user.count returns totalUsers
      // order.count returns totalOrders
      // service.count returns activeServices
      mockCount
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(500) // totalOrders
        .mockResolvedValueOnce(25); // activeServices

      mockAggregate.mockResolvedValue({ _sum: { price: 15000 } });
      mockFindMany.mockResolvedValue([mockOrderRecord]);

      const result = await getDashboardStats();

      expect(result.totalUsers).toBe(100);
      expect(result.totalOrders).toBe(500);
      expect(result.totalRevenue).toBe(15000);
      expect(result.activeServices).toBe(25);
      expect(result.recentOrders).toHaveLength(1);
      const first = result.recentOrders[0];
      expect(first?.orderId).toBe('order-1');
    });

    it('should return 0 revenue when no completed orders', async () => {
      mockCount.mockResolvedValueOnce(10).mockResolvedValueOnce(0).mockResolvedValueOnce(5);

      mockAggregate.mockResolvedValue({ _sum: { price: null } });
      mockFindMany.mockResolvedValue([]);

      const result = await getDashboardStats();

      expect(result.totalRevenue).toBe(0);
      expect(result.recentOrders).toHaveLength(0);
    });

    it('should return empty recent orders when none exist', async () => {
      mockCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      mockAggregate.mockResolvedValue({ _sum: { price: null } });
      mockFindMany.mockResolvedValue([]);

      const result = await getDashboardStats();

      expect(result.totalUsers).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.activeServices).toBe(0);
      expect(result.recentOrders).toHaveLength(0);
    });
  });
});
