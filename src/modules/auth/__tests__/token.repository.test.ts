import type Redis from 'ioredis';
import { createTokenRepository } from '../token.repository';
import type { PrismaClient } from '../../../generated/prisma';

function createMockPrisma(): {
  prisma: PrismaClient;
  refreshToken: { create: jest.Mock; findFirst: jest.Mock; updateMany: jest.Mock };
} {
  const refreshToken = {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = { refreshToken } as unknown as PrismaClient;
  return { prisma, refreshToken };
}

function createMockRedis(): {
  redis: Redis;
  set: jest.Mock;
  get: jest.Mock;
} {
  const set = jest.fn().mockResolvedValue('OK');
  const get = jest.fn().mockResolvedValue(null);
  const redis = { set, get } as unknown as Redis;
  return { redis, set, get };
}

describe('Token Store', () => {
  describe('saveRefreshToken', () => {
    it('should save a refresh token to DB', async () => {
      const { prisma, refreshToken } = createMockPrisma();
      const { redis } = createMockRedis();
      const repo = createTokenRepository(prisma, redis);

      const expiresAt = new Date();
      await repo.saveRefreshToken('user1', 'hash1', expiresAt);

      expect(refreshToken.create).toHaveBeenCalledWith({
        data: { userId: 'user1', tokenHash: 'hash1', expiresAt },
      });
    });
  });

  describe('findRefreshToken', () => {
    it('should find active non-revoked token', async () => {
      const { prisma, refreshToken } = createMockPrisma();
      const { redis } = createMockRedis();
      const token = { id: '1', userId: 'u1', tokenHash: 'h1' };
      refreshToken.findFirst.mockResolvedValue(token);
      const repo = createTokenRepository(prisma, redis);

      const result = await repo.findRefreshToken('h1');

      expect(result).toEqual(token);
      expect(refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: 'h1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should return null when not found', async () => {
      const { prisma, refreshToken } = createMockPrisma();
      const { redis } = createMockRedis();
      refreshToken.findFirst.mockResolvedValue(null);
      const repo = createTokenRepository(prisma, redis);

      const result = await repo.findRefreshToken('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should set revokedAt on the token', async () => {
      const { prisma, refreshToken } = createMockPrisma();
      const { redis } = createMockRedis();
      const repo = createTokenRepository(prisma, redis);

      await repo.revokeRefreshToken('hash1');

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'hash1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      const { prisma, refreshToken } = createMockPrisma();
      const { redis } = createMockRedis();
      const repo = createTokenRepository(prisma, redis);

      await repo.revokeAllUserTokens('user1');

      expect(refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('blacklistAccessToken', () => {
    it('should set key in Redis with TTL', async () => {
      const { prisma } = createMockPrisma();
      const { redis, set } = createMockRedis();
      const repo = createTokenRepository(prisma, redis);

      await repo.blacklistAccessToken('jti-123', 3600);

      expect(set).toHaveBeenCalledWith('bl:jti-123', '1', 'EX', 3600);
    });
  });

  describe('isAccessTokenBlacklisted', () => {
    it('should return false when not blacklisted', async () => {
      const { prisma } = createMockPrisma();
      const { redis, get } = createMockRedis();
      get.mockResolvedValue(null);
      const repo = createTokenRepository(prisma, redis);

      const result = await repo.isAccessTokenBlacklisted('jti-123');

      expect(result).toBe(false);
    });

    it('should return true when blacklisted', async () => {
      const { prisma } = createMockPrisma();
      const { redis, get } = createMockRedis();
      get.mockResolvedValue('1');
      const repo = createTokenRepository(prisma, redis);

      const result = await repo.isAccessTokenBlacklisted('jti-456');

      expect(result).toBe(true);
    });
  });
});
