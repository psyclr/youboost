import { getPrisma } from '../../shared/database';
import { getRedis } from '../../shared/redis';

const BLACKLIST_PREFIX = 'bl:';

interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
  const prisma = getPrisma();
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function blacklistAccessToken(jti: string, expiresIn: number): Promise<void> {
  const redis = getRedis();
  await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', expiresIn);
}

export async function isAccessTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
  return result !== null;
}
