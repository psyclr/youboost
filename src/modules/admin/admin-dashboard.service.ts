import type { Logger } from 'pino';
import type { AdminDashboardRepository } from './admin-dashboard.repository';
import type { DashboardStats } from './admin.types';

export interface AdminDashboardService {
  getDashboardStats(): Promise<DashboardStats>;
}

export interface AdminDashboardServiceDeps {
  dashboardRepo: AdminDashboardRepository;
  logger: Logger;
}

export function createAdminDashboardService(
  deps: AdminDashboardServiceDeps,
): AdminDashboardService {
  const { dashboardRepo, logger } = deps;

  async function getDashboardStats(): Promise<DashboardStats> {
    const [totalUsers, totalOrders, activeServices, totalRevenue, recentOrderRecords] =
      await Promise.all([
        dashboardRepo.countUsers(),
        dashboardRepo.countOrders(),
        dashboardRepo.countActiveServices(),
        dashboardRepo.sumRevenueByStatuses(['COMPLETED', 'PARTIAL']),
        dashboardRepo.findRecentOrders(10),
      ]);

    const recentOrders = recentOrderRecords.map((r) => ({
      orderId: r.id,
      userId: r.userId,
      serviceId: r.serviceId,
      status: r.status,
      quantity: r.quantity,
      price: Number(r.price),
      link: r.link,
      startCount: r.startCount,
      remains: r.remains,
      isDripFeed: r.isDripFeed,
      dripFeedRuns: r.dripFeedRuns,
      dripFeedRunsCompleted: r.dripFeedRunsCompleted,
      dripFeedInterval: r.dripFeedInterval,
      dripFeedPausedAt: r.dripFeedPausedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt,
    }));

    logger.info({ totalUsers, totalOrders, activeServices }, 'Dashboard stats fetched');

    return {
      totalUsers,
      totalOrders,
      totalRevenue,
      activeServices,
      recentOrders,
    };
  }

  return { getDashboardStats };
}
