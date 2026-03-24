import { getPrisma } from '../../shared/database';
import { createServiceLogger } from '../../shared/utils/logger';
import type { DashboardStats } from './admin.types';

const log = createServiceLogger('admin-dashboard');

export async function getDashboardStats(): Promise<DashboardStats> {
  const prisma = getPrisma();

  const [totalUsers, totalOrders, activeServices, revenueResult, recentOrderRecords] =
    await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        _sum: { price: true },
        where: { status: { in: ['COMPLETED', 'PARTIAL'] } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

  const totalRevenue = revenueResult._sum.price ? Number(revenueResult._sum.price) : 0;

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
