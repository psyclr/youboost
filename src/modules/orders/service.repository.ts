import type { PrismaClient } from '../../generated/prisma';
import type { ServiceRecord, CreateServiceData, UpdateServiceData } from './orders.types';

interface ServiceFilters {
  platform?: string;
  type?: string;
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

export interface ServicesRepository {
  findServiceById(serviceId: string): Promise<ServiceRecord | null>;
  findActiveServices(filters?: ServiceFilters): Promise<ServiceRecord[]>;
  findAllServices(filters?: { isActive?: boolean }): Promise<ServiceRecord[]>;
  findAllServicesPaginatedWithProvider(
    page: number,
    limit: number,
  ): Promise<{
    services: Array<ServiceRecord & { provider: { id: string; name: string } | null }>;
    total: number;
  }>;
  findServiceWithProvider(
    id: string,
  ): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null>;
  createService(data: CreateServiceData): Promise<ServiceRecord>;
  updateService(serviceId: string, data: UpdateServiceData): Promise<ServiceRecord>;
  deactivateService(serviceId: string): Promise<ServiceRecord>;
}

export function createServicesRepository(prisma: PrismaClient): ServicesRepository {
  async function findServiceById(serviceId: string): Promise<ServiceRecord | null> {
    return prisma.service.findUnique({
      where: { id: serviceId },
    });
  }

  async function findActiveServices(filters?: ServiceFilters): Promise<ServiceRecord[]> {
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

  async function findAllServices(filters?: { isActive?: boolean }): Promise<ServiceRecord[]> {
    const where: Record<string, unknown> = {};
    if (filters?.isActive != null) {
      where.isActive = filters.isActive;
    }

    return prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async function findAllServicesPaginatedWithProvider(
    page: number,
    limit: number,
  ): Promise<{
    services: Array<ServiceRecord & { provider: { id: string; name: string } | null }>;
    total: number;
  }> {
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

  async function findServiceWithProvider(
    id: string,
  ): Promise<(ServiceRecord & { provider: { id: string; name: string } | null }) | null> {
    return prisma.service.findUnique({
      where: { id },
      include: { provider: { select: { id: true, name: true } } },
    });
  }

  async function createService(data: CreateServiceData): Promise<ServiceRecord> {
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

  async function updateService(serviceId: string, data: UpdateServiceData): Promise<ServiceRecord> {
    return prisma.service.update({
      where: { id: serviceId },
      data: buildUpdateData(data),
    });
  }

  async function deactivateService(serviceId: string): Promise<ServiceRecord> {
    return prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
  }

  return {
    findServiceById,
    findActiveServices,
    findAllServices,
    findAllServicesPaginatedWithProvider,
    findServiceWithProvider,
    createService,
    updateService,
    deactivateService,
  };
}
