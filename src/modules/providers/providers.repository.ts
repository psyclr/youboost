import { getPrisma } from '../../shared/database';
import type { Prisma, PrismaClient } from '../../generated/prisma';
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

export interface ProvidersRepository {
  createProvider(data: CreateProviderData): Promise<ProviderRecord>;
  findProviderById(id: string): Promise<ProviderRecord | null>;
  findProviders(filters: ProviderFilters): Promise<{ providers: ProviderRecord[]; total: number }>;
  findActiveProvidersByPriority(): Promise<ProviderRecord[]>;
  updateProvider(id: string, data: UpdateProviderData): Promise<ProviderRecord>;
}

export function createProvidersRepository(prisma: PrismaClient): ProvidersRepository {
  async function createProvider(data: CreateProviderData): Promise<ProviderRecord> {
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

  async function findProviderById(id: string): Promise<ProviderRecord | null> {
    return prisma.provider.findUnique({ where: { id } });
  }

  async function findProviders(
    filters: ProviderFilters,
  ): Promise<{ providers: ProviderRecord[]; total: number }> {
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

  async function findActiveProvidersByPriority(): Promise<ProviderRecord[]> {
    return prisma.provider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  async function updateProvider(id: string, data: UpdateProviderData): Promise<ProviderRecord> {
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

  return {
    createProvider,
    findProviderById,
    findProviders,
    findActiveProvidersByPriority,
    updateProvider,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createProvider(data: CreateProviderData): Promise<ProviderRecord> {
  return createProvidersRepository(getPrisma()).createProvider(data);
}

export async function findProviderById(id: string): Promise<ProviderRecord | null> {
  return createProvidersRepository(getPrisma()).findProviderById(id);
}

export async function findProviders(
  filters: ProviderFilters,
): Promise<{ providers: ProviderRecord[]; total: number }> {
  return createProvidersRepository(getPrisma()).findProviders(filters);
}

export async function findActiveProvidersByPriority(): Promise<ProviderRecord[]> {
  return createProvidersRepository(getPrisma()).findActiveProvidersByPriority();
}

export async function updateProvider(
  id: string,
  data: UpdateProviderData,
): Promise<ProviderRecord> {
  return createProvidersRepository(getPrisma()).updateProvider(id, data);
}
