import { createApiKeySchema, apiKeyIdSchema, apiKeysQuerySchema } from '../api-keys.types';

describe('API Keys Types', () => {
  describe('createApiKeySchema', () => {
    it('should validate valid input', () => {
      const result = createApiKeySchema.safeParse({ name: 'My Key' });
      expect(result.success).toBe(true);
    });

    it('should default rateLimitTier to BASIC', () => {
      const result = createApiKeySchema.safeParse({ name: 'My Key' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.rateLimitTier).toBe('BASIC');
    });

    it('should accept PRO tier', () => {
      const result = createApiKeySchema.safeParse({ name: 'Key', rateLimitTier: 'PRO' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.rateLimitTier).toBe('PRO');
    });

    it('should accept ENTERPRISE tier', () => {
      const result = createApiKeySchema.safeParse({ name: 'Key', rateLimitTier: 'ENTERPRISE' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createApiKeySchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject name over 255 chars', () => {
      const result = createApiKeySchema.safeParse({ name: 'x'.repeat(256) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid tier', () => {
      const result = createApiKeySchema.safeParse({ name: 'Key', rateLimitTier: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should accept optional permissions array', () => {
      const result = createApiKeySchema.safeParse({ name: 'Key', permissions: ['read', 'write'] });
      expect(result.success).toBe(true);
    });

    it('should accept optional expiresAt date', () => {
      const result = createApiKeySchema.safeParse({
        name: 'Key',
        expiresAt: '2027-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('apiKeyIdSchema', () => {
    it('should validate a valid UUID', () => {
      const result = apiKeyIdSchema.safeParse({
        keyId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = apiKeyIdSchema.safeParse({ keyId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('apiKeysQuerySchema', () => {
    it('should apply defaults', () => {
      const result = apiKeysQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid page and limit', () => {
      const result = apiKeysQuerySchema.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject page less than 1', () => {
      const result = apiKeysQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = apiKeysQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should parse isActive boolean string', () => {
      const result = apiKeysQuerySchema.safeParse({ isActive: 'true' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });
  });
});
