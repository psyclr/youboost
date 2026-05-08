import { createApiKeysService, hashApiKey } from '../api-keys.service';
import { createFakeApiKeysRepository, silentLogger } from './fakes';
import type { ApiKeyRecord } from '../api-keys.types';

function makeRecord(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    id: 'key-seed',
    userId: 'user-1',
    keyHash: 'seed-hash',
    name: 'Seed Key',
    permissions: null,
    rateLimitTier: 'BASIC',
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    ...overrides,
  };
}

describe('API Keys Service', () => {
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

  describe('createApiKey', () => {
    it('should generate a key with yb_ prefix', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const { rawKey } = await service.createApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
      });

      expect(rawKey).toMatch(/^yb_[a-f0-9]{64}$/);
    });

    it('should return apiKey response without keyHash', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const { apiKey } = await service.createApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
      });

      expect(apiKey.id).toBe('key-1');
      expect(apiKey.name).toBe('Test');
      expect((apiKey as unknown as Record<string, unknown>).keyHash).toBeUndefined();
    });

    it('should store hashed key in repository', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.createApiKey('user-1', { name: 'Test', rateLimitTier: 'PRO' });

      expect(apiKeysRepo.calls.createApiKey).toHaveLength(1);
      expect(apiKeysRepo.calls.createApiKey[0]).toMatchObject({
        userId: 'user-1',
        rateLimitTier: 'PRO',
      });
      expect(apiKeysRepo.calls.createApiKey[0]?.keyHash).toEqual(expect.any(String));
    });

    it('should pass permissions to repository', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.createApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
        permissions: ['read'],
      });

      expect(apiKeysRepo.calls.createApiKey[0]?.permissions).toEqual(['read']);
    });

    it('should pass expiresAt to repository', async () => {
      const expiresAt = new Date('2027-01-01');
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.createApiKey('user-1', {
        name: 'Test',
        rateLimitTier: 'BASIC',
        expiresAt,
      });

      expect(apiKeysRepo.calls.createApiKey[0]?.expiresAt).toEqual(expiresAt);
    });

    it('should generate unique keys each time', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const { rawKey: key1 } = await service.createApiKey('user-1', {
        name: 'K1',
        rateLimitTier: 'BASIC',
      });
      const { rawKey: key2 } = await service.createApiKey('user-1', {
        name: 'K2',
        rateLimitTier: 'BASIC',
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('listApiKeys', () => {
    it('should return paginated api keys', async () => {
      const record = makeRecord({ id: 'key-seed-1' });
      const apiKeysRepo = createFakeApiKeysRepository({ keys: [record] });
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const result = await service.listApiKeys('user-1', { page: 1, limit: 20 });

      expect(result.apiKeys).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.listApiKeys('user-1', { page: 2, limit: 10, isActive: true });

      expect(apiKeysRepo.calls.findApiKeysByUserId).toEqual([
        { userId: 'user-1', filters: { isActive: true, page: 2, limit: 10 } },
      ]);
    });

    it('should omit isActive when not provided', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.listApiKeys('user-1', { page: 1, limit: 20 });

      expect(apiKeysRepo.calls.findApiKeysByUserId).toEqual([
        { userId: 'user-1', filters: { page: 1, limit: 20 } },
      ]);
    });

    it('should calculate totalPages correctly', async () => {
      const records = Array.from({ length: 45 }, (_, i) => makeRecord({ id: `key-seed-${i}` }));
      const apiKeysRepo = createFakeApiKeysRepository({ keys: records });
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const result = await service.listApiKeys('user-1', { page: 1, limit: 20 });

      expect(result.pagination.total).toBe(45);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should not expose keyHash in response', async () => {
      const record = makeRecord({ id: 'key-seed-1' });
      const apiKeysRepo = createFakeApiKeysRepository({ keys: [record] });
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      const result = await service.listApiKeys('user-1', { page: 1, limit: 20 });

      expect((result.apiKeys[0] as unknown as Record<string, unknown>).keyHash).toBeUndefined();
    });
  });

  describe('revokeApiKey', () => {
    it('should call deleteApiKey in repository', async () => {
      const apiKeysRepo = createFakeApiKeysRepository();
      const service = createApiKeysService({ apiKeysRepo, logger: silentLogger });

      await service.revokeApiKey('user-1', 'key-1');

      expect(apiKeysRepo.calls.deleteApiKey).toEqual([{ keyId: 'key-1', userId: 'user-1' }]);
    });
  });
});
