import { getPrisma } from '../../shared/database';
import type { ServiceRecord } from './orders.types';

export async function findServiceById(serviceId: string): Promise<ServiceRecord | null> {
  const prisma = getPrisma();
  return prisma.service.findUnique({
    where: { id: serviceId },
  });
}

interface ServiceFilters {
  platform?: string;
  type?: string;
}

export async function findActiveServices(filters?: ServiceFilters): Promise<ServiceRecord[]> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { isActive: true };
  if (filters?.platform) {
    where.platform = filters.platform;
  }
  if (filters?.type) {
    where.type = filters.type;
  }

  return prisma.service.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}
