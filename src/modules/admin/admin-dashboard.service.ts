import { createServiceLogger } from '../../shared/utils/logger';
import * as repo from './admin-dashboard.repository';
import type { DashboardStats } from './admin.types';

const log = createServiceLogger('admin-dashboard');

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalUsers, totalOrders, activeServices, totalRevenue, recentOrderRecords] =
    await Promise.all([
      repo.countUsers(),
      repo.countOrders(),
      repo.countActiveServices(),
      repo.sumRevenueByStatuses(['COMPLETED', 'PARTIAL']),
      repo.findRecentOrders(10),
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

  log.info({ totalUsers, totalOrders, activeServices }, 'Dashboard stats fetched');

  return {
    totalUsers,
    totalOrders,
    totalRevenue,
    activeServices,
    recentOrders,
  };
}
