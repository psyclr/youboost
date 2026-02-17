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
    },
  });
}

export async function updateService(
  serviceId: string,
  data: UpdateServiceData,
): Promise<ServiceRecord> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};
  if (data.name != null) updateData.name = data.name;
  if (data.description != null) updateData.description = data.description;
  if (data.platform != null) updateData.platform = data.platform;
  if (data.type != null) updateData.type = data.type;
  if (data.pricePer1000 != null) updateData.pricePer1000 = data.pricePer1000;
  if (data.minQuantity != null) updateData.minQuantity = data.minQuantity;
  if (data.maxQuantity != null) updateData.maxQuantity = data.maxQuantity;
  if (data.isActive != null) updateData.isActive = data.isActive;

  return prisma.service.update({
    where: { id: serviceId },
    data: updateData,
  });
}

export async function deactivateService(serviceId: string): Promise<ServiceRecord> {
  const prisma = getPrisma();
  return prisma.service.update({
    where: { id: serviceId },
    data: { isActive: false },
  });
}
