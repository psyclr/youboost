import { getPrisma } from '../../shared/database';
import type { Prisma } from '../../generated/prisma';
import type { ProviderRecord } from './providers.types';

interface CreateProviderData {
  name: string;
  apiEndpoint: string;
  apiKeyEncrypted: string;
  priority: number;
  metadata?: Record<string, unknown>;
}

interface UpdateProviderData {
  name?: string;
  apiEndpoint?: string;
  apiKeyEncrypted?: string;
  priority?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

interface ProviderFilters {
  isActive?: boolean;
  page: number;
  limit: number;
}

export async function createProvider(data: CreateProviderData): Promise<ProviderRecord> {
  const prisma = getPrisma();
  return prisma.provider.create({
    data: {
      name: data.name,
      apiEndpoint: data.apiEndpoint,
      apiKeyEncrypted: data.apiKeyEncrypted,
      priority: data.priority,
      ...(data.metadata ? { metadata: data.metadata as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function findProviderById(id: string): Promise<ProviderRecord | null> {
  const prisma = getPrisma();
  return prisma.provider.findUnique({ where: { id } });
}

export async function findProviders(
  filters: ProviderFilters,
): Promise<{ providers: ProviderRecord[]; total: number }> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const [providers, total] = await Promise.all([
    prisma.provider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.provider.count({ where }),
  ]);

  return { providers, total };
}

export async function findActiveProvidersByPriority(): Promise<ProviderRecord[]> {
  const prisma = getPrisma();
  return prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });
}

export async function updateProvider(
  id: string,
  data: UpdateProviderData,
): Promise<ProviderRecord> {
  const prisma = getPrisma();
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.apiEndpoint !== undefined) updateData.apiEndpoint = data.apiEndpoint;
  if (data.apiKeyEncrypted !== undefined) updateData.apiKeyEncrypted = data.apiKeyEncrypted;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.metadata !== undefined) updateData.metadata = data.metadata as Prisma.InputJsonValue;

  return prisma.provider.update({
    where: { id },
    data: updateData,
  });
}
