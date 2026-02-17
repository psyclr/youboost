import { getPrisma } from '../../shared/database';
import type { ServiceRecord } from '../orders/orders.types';

interface CatalogFilters {
  platform?: string | undefined;
  type?: string | undefined;
  page: number;
  limit: number;
}

export async function findActiveServices(
  filters: CatalogFilters,
): Promise<{ services: ServiceRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { isActive: true };
  if (filters.platform) {
    where.platform = filters.platform;
  }
  if (filters.type) {
    where.type = filters.type;
  }

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.service.count({ where }),
  ]);

  return { services, total };
}

export async function findActiveServiceById(serviceId: string): Promise<ServiceRecord | null> {
  const prisma = getPrisma();
  return prisma.service.findFirst({
    where: { id: serviceId, isActive: true },
  });
}
