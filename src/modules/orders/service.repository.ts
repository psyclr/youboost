import { getPrisma } from '../../shared/database';
import type { ServiceRecord, CreateServiceData, UpdateServiceData } from './orders.types';

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

export async function findAllServices(filters?: { isActive?: boolean }): Promise<ServiceRecord[]> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters?.isActive != null) {
    where.isActive = filters.isActive;
  }

  return prisma.service.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

export async function findAllServicesPaginated(
  page: number,
  limit: number,
): Promise<{ services: ServiceRecord[]; total: number }> {
  const prisma = getPrisma();
  const [services, total] = await Promise.all([
    prisma.service.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.service.count(),
  ]);
  return { services, total };
}

export async function findAllServicesPaginatedWithProvider(
  page: number,
  limit: number,
): Promise<{
  services: Array<ServiceRecord & { provider: { id: string; name: string } | null }>;
  total: number;
}> {
  const prisma = getPrisma();
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: { provider: { select: { id: true, name: true } } },
    }),
    prisma.service.count(),
  ]);
  return { services, total };
}

export async function findServiceWithProvider(
  id: string,
): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null> {
  const prisma = getPrisma();
  return prisma.service.findUnique({
    where: { id },
    include: { provider: { select: { id: true, name: true } } },
  });
}

export async function createService(data: CreateServiceData): Promise<ServiceRecord> {
  const prisma = getPrisma();
  return prisma.service.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      platform: data.platform as 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'TWITTER' | 'FACEBOOK',
      type: data.type as 'VIEWS' | 'SUBSCRIBERS' | 'LIKES' | 'COMMENTS' | 'SHARES',
      pricePer1000: data.pricePer1000,
      minQuantity: data.minQuantity,
      maxQuantity: data.maxQuantity,
      providerId: data.providerId ?? null,
      externalServiceId: data.externalServiceId ?? null,
    },
  });
}

function buildUpdateData(data: UpdateServiceData): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  const nullableFields = [
    'name',
    'description',
    'platform',
    'type',
    'pricePer1000',
    'minQuantity',
    'maxQuantity',
    'isActive',
  ] as const;

  for (const field of nullableFields) {
    if (data[field] != null) {
      updateData[field] = data[field];
    }
  }

  if (data.providerId !== undefined) updateData.providerId = data.providerId;
  if (data.externalServiceId !== undefined) updateData.externalServiceId = data.externalServiceId;

  return updateData;
}

export async function updateService(
  serviceId: string,
  data: UpdateServiceData,
): Promise<ServiceRecord> {
  const prisma = getPrisma();
  return prisma.service.update({
    where: { id: serviceId },
    data: buildUpdateData(data),
  });
}

export async function deactivateService(serviceId: string): Promise<ServiceRecord> {
  const prisma = getPrisma();
  return prisma.service.update({
    where: { id: serviceId },
    data: { isActive: false },
  });
}
