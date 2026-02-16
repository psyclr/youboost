import {
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
} from '../token-store';

const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdateMany = jest.fn();
const mockRedisSet = jest.fn().mockResolvedValue('OK');
const mockRedisGet = jest.fn().mockResolvedValue(null);

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    refreshToken: {
      create: (...args: unknown[]) => mockCreate(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  }),
}));

jest.mock('../../../shared/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    set: (...args: unknown[]) => mockRedisSet(...args),
    get: (...args: unknown[]) => mockRedisGet(...args),
  }),
}));

describe('Token Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveRefreshToken', () => {
    it('should save a refresh token to DB', async () => {
      const expiresAt = new Date();
      await saveRefreshToken('user1', 'hash1', expiresAt);
      expect(mockCreate).toHaveBeenCalledWith({
        data: { userId: 'user1', tokenHash: 'hash1', expiresAt },
      });
    });
  });

  describe('findRefreshToken', () => {
    it('should find active non-revoked token', async () => {
      const token = { id: '1', userId: 'u1', tokenHash: 'h1' };
      mockFindFirst.mockResolvedValue(token);
      const result = await findRefreshToken('h1');
      expect(result).toEqual(token);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: 'h1',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await findRefreshToken('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should set revokedAt on the token', async () => {
      await revokeRefreshToken('hash1');
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { tokenHash: 'hash1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      await revokeAllUserTokens('user1');
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'user1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('blacklistAccessToken', () => {
    it('should set key in Redis with TTL', async () => {
      await blacklistAccessToken('jti-123', 3600);
      expect(mockRedisSet).toHaveBeenCalledWith('bl:jti-123', '1', 'EX', 3600);
    });
  });

  describe('isAccessTokenBlacklisted', () => {
    it('should return false when not blacklisted', async () => {
      mockRedisGet.mockResolvedValue(null);
      const result = await isAccessTokenBlacklisted('jti-123');
      expect(result).toBe(false);
    });

    it('should return true when blacklisted', async () => {
      mockRedisGet.mockResolvedValue('1');
      const result = await isAccessTokenBlacklisted('jti-456');
      expect(result).toBe(true);
    });
  });
});
