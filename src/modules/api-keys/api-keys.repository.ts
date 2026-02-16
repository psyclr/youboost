import { getPrisma } from '../../shared/database';
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

export async function createApiKey(data: CreateApiKeyData): Promise<ApiKeyRecord> {
  const prisma = getPrisma();
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

export async function findApiKeysByUserId(
  userId: string,
  filters: ApiKeyFilters,
): Promise<{ apiKeys: ApiKeyRecord[]; total: number }> {
  const prisma = getPrisma();
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

export async function findApiKeyByHash(
  keyHash: string,
): Promise<(ApiKeyRecord & { user: { role: string; email: string } }) | null> {
  const prisma = getPrisma();
  return prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { role: true, email: true } } },
  });
}

export async function deleteApiKey(keyId: string, userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.apiKey.updateMany({
    where: { id: keyId, userId },
    data: { isActive: false },
  });
}

export async function updateLastUsedAt(keyId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { lastUsedAt: new Date() },
  });
}
