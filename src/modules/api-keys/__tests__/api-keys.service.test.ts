import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  hashApiKey,
  getApiKeyByHash,
} from '../api-keys.service';

const mockCreateApiKey = jest.fn();
const mockFindApiKeysByUserId = jest.fn();
const mockDeleteApiKey = jest.fn();
const mockFindApiKeyByHash = jest.fn();

jest.mock('../api-keys.repository', () => ({
  createApiKey: (...args: unknown[]): unknown => mockCreateApiKey(...args),
  findApiKeysByUserId: (...args: unknown[]): unknown => mockFindApiKeysByUserId(...args),
  deleteApiKey: (...args: unknown[]): unknown => mockDeleteApiKey(...args),
  findApiKeyByHash: (...args: unknown[]): unknown => mockFindApiKeyByHash(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockRecord = {
  id: 'key-1',
  userId: 'user-1',
  keyHash: 'hash',
  name: 'Test Key',
  permissions: null,
  rateLimitTier: 'BASIC',
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
};

describe('API Keys Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('hashApiKey', () => {
    it('should produce a consistent SHA-256 hash', () => {
      const hash1 = hashApiKey('test-key');
      const hash2 = hashApiKey('test-key');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different hashes for different keys', () => {
      expect(hashApiKey('key-1')).not.toBe(hashApiKey('key-2'));
    });
  });

  describe('generateApiKey', () => {
    it('should generate a key with yb_ prefix', async () => {
      mockCreateApiKey.mockResolvedValue(mockRecord);
      const { rawKey } = await generateApiKey('user-1', { name: 'Test', rateLimitTier: 'BASIC' });
      expect(rawKey).toMatch(/^yb_[a-f0-9]{64}$/);
    });

    it('should return apiKey response without keyHash', async () => {
      mockCreateApiKey.mockResolvedValue(mockRecord);
      const { apiKey } = await generateApiKey('user-1', { name: 'Test', rateLimitTier: 'BASIC' });
      expect(apiKey.id).toBe('key-1');
      expect(apiKey.name).toBe('Test Key');
      expect((apiKey as unknown as Record<string, unknown>).keyHash).toBeUndefined();
    });

    it('should store hashed key in repository', async () => {
      mockCreateApiKey.mockResolvedValue(mockRecord);
      await generateApiKey('user-1', { name: 'Test', rateLimitTier: 'PRO' });
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          rateLimitTier: 'PRO',
          keyHash: expect.any(String),
        }),
      );
    });

    it('should pass permissions to repository', async () => {
      mockCreateApiKey.mockResolvedValue(mockRecord);
      await generateApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
        permissions: ['read'],
      });
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: ['read'] }),
      );
    });

    it('should pass expiresAt to repository', async () => {
      const expiresAt = new Date('2027-01-01');
      mockCreateApiKey.mockResolvedValue(mockRecord);
      await generateApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
        expiresAt,
      });
      expect(mockCreateApiKey).toHaveBeenCalledWith(expect.objectContaining({ expiresAt }));
    });

    it('should generate unique keys each time', async () => {
      mockCreateApiKey.mockResolvedValue(mockRecord);
      const { rawKey: key1 } = await generateApiKey('user-1', {
        name: 'K1',
        rateLimitTier: 'BASIC',
      });
      const { rawKey: key2 } = await generateApiKey('user-1', {
        name: 'K2',
        rateLimitTier: 'BASIC',
      });
      expect(key1).not.toBe(key2);
    });
  });

  describe('listApiKeys', () => {
    it('should return paginated api keys', async () => {
      mockFindApiKeysByUserId.mockResolvedValue({ apiKeys: [mockRecord], total: 1 });
      const result = await listApiKeys('user-1', { page: 1, limit: 20 });
      expect(result.apiKeys).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass filters to repository', async () => {
      mockFindApiKeysByUserId.mockResolvedValue({ apiKeys: [], total: 0 });
      await listApiKeys('user-1', { page: 2, limit: 10, isActive: true });
      expect(mockFindApiKeysByUserId).toHaveBeenCalledWith('user-1', {
        isActive: true,
        page: 2,
        limit: 10,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockFindApiKeysByUserId.mockResolvedValue({ apiKeys: [], total: 45 });
      const result = await listApiKeys('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should not expose keyHash in response', async () => {
      mockFindApiKeysByUserId.mockResolvedValue({ apiKeys: [mockRecord], total: 1 });
      const result = await listApiKeys('user-1', { page: 1, limit: 20 });
      expect((result.apiKeys[0] as unknown as Record<string, unknown>).keyHash).toBeUndefined();
    });
  });

  describe('revokeApiKey', () => {
    it('should call deleteApiKey in repository', async () => {
      mockDeleteApiKey.mockResolvedValue(undefined);
      await revokeApiKey('user-1', 'key-1');
      expect(mockDeleteApiKey).toHaveBeenCalledWith('key-1', 'user-1');
    });
  });

  describe('getApiKeyByHash', () => {
    it('should return record when found', async () => {
      mockFindApiKeyByHash.mockResolvedValue(mockRecord);
      const result = await getApiKeyByHash('hash');
      expect(result).toEqual(mockRecord);
    });

    it('should throw NotFoundError when not found', async () => {
      mockFindApiKeyByHash.mockResolvedValue(null);
      await expect(getApiKeyByHash('bad')).rejects.toThrow('API key not found');
    });
  });
});
