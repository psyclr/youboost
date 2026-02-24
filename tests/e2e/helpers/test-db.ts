import { getPrisma } from '@/shared/database/prisma';
import { getRedis } from '@/shared/redis/redis';
import { hashPassword } from '@/modules/auth/utils/password';
import type { Platform, ServiceType, UserRole, UserStatus } from '@/generated/prisma';

export async function truncateAllTables(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
      notifications,
      deposits,
      webhooks,
      api_keys,
      orders,
      ledger,
      wallets,
      refresh_tokens,
      users,
      providers,
      services
    CASCADE`,
  );
}

export async function flushTestRedis(): Promise<void> {
  const redis = getRedis();
  await redis.flushdb();
}

export async function seedService(overrides?: {
  name?: string;
  platform?: string;
  type?: string;
  pricePer1000?: number;
  minQuantity?: number;
  maxQuantity?: number;
}): Promise<{
  id: string;
  name: string;
  platform: string;
  type: string;
  pricePer1000: number;
  minQuantity: number;
  maxQuantity: number;
}> {
  const prisma = getPrisma();
  const service = await prisma.service.create({
    data: {
      name: overrides?.name ?? 'YouTube Views',
      platform: (overrides?.platform ?? 'YOUTUBE') as Platform,
      type: (overrides?.type ?? 'VIEWS') as ServiceType,
      pricePer1000: overrides?.pricePer1000 ?? 2.5,
      minQuantity: overrides?.minQuantity ?? 100,
      maxQuantity: overrides?.maxQuantity ?? 1000000,
      isActive: true,
    },
  });

  return {
    id: service.id,
    name: service.name,
    platform: service.platform,
    type: service.type,
    pricePer1000: Number(service.pricePer1000),
    minQuantity: service.minQuantity,
    maxQuantity: service.maxQuantity,
  };
}

export async function seedAdminUser(
  password = 'AdminPass123',
): Promise<{ id: string; email: string; username: string; password: string }> {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  const ts = Date.now();
  const email = `admin-${ts}@example.com`;
  const username = `admin_${ts}`;

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: 'ADMIN' as UserRole,
      status: 'ACTIVE' as UserStatus,
    },
  });

  return { id: user.id, email, username, password };
}

export async function seedProvider(): Promise<{ id: string }> {
  const { encryptApiKey } = await import('@/modules/providers/utils/encryption');
  const prisma = getPrisma();
  const provider = await prisma.provider.create({
    data: {
      name: 'Test Provider',
      apiEndpoint: 'http://localhost:19999/api',
      apiKeyEncrypted: encryptApiKey('test-provider-api-key'),
      isActive: true,
      priority: 1,
    },
  });
  return { id: provider.id };
}
