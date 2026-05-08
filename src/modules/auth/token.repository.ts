import type { PrismaClient } from '../../generated/prisma';
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

export interface TokenRepository {
  saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
  blacklistAccessToken(jti: string, expiresIn: number): Promise<void>;
  isAccessTokenBlacklisted(jti: string): Promise<boolean>;
}

export function createTokenRepository(prisma: PrismaClient): TokenRepository {
  async function saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async function revokeRefreshToken(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async function revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async function blacklistAccessToken(jti: string, expiresIn: number): Promise<void> {
    const redis = getRedis();
    await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', expiresIn);
  }

  async function isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
    return result !== null;
  }

  return {
    saveRefreshToken,
    findRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    blacklistAccessToken,
    isAccessTokenBlacklisted,
  };
}
