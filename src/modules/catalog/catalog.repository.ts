import { getPrisma } from '../../shared/database';
import type { PrismaClient } from '../../generated/prisma';
import type { ServiceRecord } from '../orders';

interface CatalogFilters {
  platform?: string | undefined;
  type?: string | undefined;
  page: number;
  limit: number;
}

export interface CatalogRepository {
  findActiveServices(
    filters: CatalogFilters,
  ): Promise<{ services: ServiceRecord[]; total: number }>;
  findActiveServiceById(serviceId: string): Promise<ServiceRecord | null>;
}

export function createCatalogRepository(prisma: PrismaClient): CatalogRepository {
  async function findActiveServices(
    filters: CatalogFilters,
  ): Promise<{ services: ServiceRecord[]; total: number }> {
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

  async function findActiveServiceById(serviceId: string): Promise<ServiceRecord | null> {
    return prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
    });
  }

  return { findActiveServices, findActiveServiceById };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function findActiveServices(
  filters: CatalogFilters,
): Promise<{ services: ServiceRecord[]; total: number }> {
  return createCatalogRepository(getPrisma()).findActiveServices(filters);
}

export async function findActiveServiceById(serviceId: string): Promise<ServiceRecord | null> {
  return createCatalogRepository(getPrisma()).findActiveServiceById(serviceId);
}
