import { getPrisma } from '../../shared/database';
import type { PrismaClient } from '../../generated/prisma';
import type { ApiKeyRecord } from './api-keys.types';

interface CreateApiKeyData {
  userId: string;
  name: string;
  keyHash: string;
  permissions?: unknown;
  rateLimitTier: string;
  expiresAt?: Date;
}

interface ApiKeyFilters {
  isActive?: boolean;
  page: number;
  limit: number;
}

export interface ApiKeyRepository {
  createApiKey(data: CreateApiKeyData): Promise<ApiKeyRecord>;
  findApiKeysByUserId(
    userId: string,
    filters: ApiKeyFilters,
  ): Promise<{ apiKeys: ApiKeyRecord[]; total: number }>;
  findApiKeyByHash(
    keyHash: string,
  ): Promise<(ApiKeyRecord & { user: { role: string; email: string } }) | null>;
  deleteApiKey(keyId: string, userId: string): Promise<void>;
  updateLastUsedAt(keyId: string): Promise<void>;
}

export function createApiKeyRepository(prisma: PrismaClient): ApiKeyRepository {
  async function createApiKey(data: CreateApiKeyData): Promise<ApiKeyRecord> {
    return prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        keyHash: data.keyHash,
        rateLimitTier: data.rateLimitTier as 'BASIC' | 'PRO' | 'ENTERPRISE',
        ...(data.permissions ? { permissions: data.permissions as object } : {}),
        ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
      },
    });
  }

  async function findApiKeysByUserId(
    userId: string,
    filters: ApiKeyFilters,
  ): Promise<{ apiKeys: ApiKeyRecord[]; total: number }> {
    const where: Record<string, unknown> = { userId };
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.apiKey.count({ where }),
    ]);

    return { apiKeys, total };
  }

  async function findApiKeyByHash(
    keyHash: string,
  ): Promise<(ApiKeyRecord & { user: { role: string; email: string } }) | null> {
    return prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { role: true, email: true } } },
    });
  }

  async function deleteApiKey(keyId: string, userId: string): Promise<void> {
    await prisma.apiKey.updateMany({
      where: { id: keyId, userId },
      data: { isActive: false },
    });
  }

  async function updateLastUsedAt(keyId: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    });
  }

  return {
    createApiKey,
    findApiKeysByUserId,
    findApiKeyByHash,
    deleteApiKey,
    updateLastUsedAt,
  };
}

// Deprecated shims — delegate to factory with shared prisma. Delete in Phase 18.
export async function createApiKey(data: CreateApiKeyData): Promise<ApiKeyRecord> {
  return createApiKeyRepository(getPrisma()).createApiKey(data);
}

export async function findApiKeysByUserId(
  userId: string,
  filters: ApiKeyFilters,
): Promise<{ apiKeys: ApiKeyRecord[]; total: number }> {
  return createApiKeyRepository(getPrisma()).findApiKeysByUserId(userId, filters);
}

export async function findApiKeyByHash(
  keyHash: string,
): Promise<(ApiKeyRecord & { user: { role: string; email: string } }) | null> {
  return createApiKeyRepository(getPrisma()).findApiKeyByHash(keyHash);
}

export async function deleteApiKey(keyId: string, userId: string): Promise<void> {
  return createApiKeyRepository(getPrisma()).deleteApiKey(keyId, userId);
}

export async function updateLastUsedAt(keyId: string): Promise<void> {
  return createApiKeyRepository(getPrisma()).updateLastUsedAt(keyId);
}
