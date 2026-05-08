import { createAdminDashboardService } from '../admin-dashboard.service';
import { createFakeAdminDashboardRepository, makeOrderRecord, silentLogger } from './fakes';

describe('Admin Dashboard Service', () => {
  describe('getDashboardStats', () => {
    it('should return dashboard stats', async () => {
      const dashboardRepo = createFakeAdminDashboardRepository({
        countUsers: 100,
        countOrders: 500,
        countActiveServices: 25,
        revenue: 15000,
        recentOrders: [
          makeOrderRecord({
            id: 'order-1',
            status: 'COMPLETED',
            completedAt: new Date('2024-01-02'),
          }),
        ],
      });
      const service = createAdminDashboardService({ dashboardRepo, logger: silentLogger });

      const result = await service.getDashboardStats();

      expect(result.totalUsers).toBe(100);
      expect(result.totalOrders).toBe(500);
      expect(result.totalRevenue).toBe(15000);
      expect(result.activeServices).toBe(25);
      expect(result.recentOrders).toHaveLength(1);
      expect(result.recentOrders[0]?.orderId).toBe('order-1');
    });

    it('should return 0 revenue when no completed orders', async () => {
      const dashboardRepo = createFakeAdminDashboardRepository({
        countUsers: 10,
        countOrders: 0,
        countActiveServices: 5,
      });
      const service = createAdminDashboardService({ dashboardRepo, logger: silentLogger });

      const result = await service.getDashboardStats();

      expect(result.totalRevenue).toBe(0);
      expect(result.recentOrders).toHaveLength(0);
    });

    it('should return empty recent orders when none exist', async () => {
      const dashboardRepo = createFakeAdminDashboardRepository();
      const service = createAdminDashboardService({ dashboardRepo, logger: silentLogger });

      const result = await service.getDashboardStats();

      expect(result.totalUsers).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.activeServices).toBe(0);
      expect(result.recentOrders).toHaveLength(0);
    });
  });
});
