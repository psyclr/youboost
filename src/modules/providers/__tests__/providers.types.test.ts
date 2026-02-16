import {
  createProviderSchema,
  updateProviderSchema,
  providerIdSchema,
  providersQuerySchema,
} from '../providers.types';

describe('Provider Types', () => {
  describe('createProviderSchema', () => {
    it('should validate valid input', () => {
      const result = createProviderSchema.safeParse({
        name: 'Provider One',
        apiEndpoint: 'https://api.provider.com/v2',
        apiKey: 'secret-key-123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(0);
      }
    });

    it('should accept optional metadata and priority', () => {
      const result = createProviderSchema.safeParse({
        name: 'Provider',
        apiEndpoint: 'https://api.provider.com',
        apiKey: 'key',
        priority: 10,
        metadata: { region: 'us' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(10);
        expect(result.data.metadata).toEqual({ region: 'us' });
      }
    });

    it('should reject empty name', () => {
      const result = createProviderSchema.safeParse({
        name: '',
        apiEndpoint: 'https://api.example.com',
        apiKey: 'key',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const result = createProviderSchema.safeParse({
        name: 'Provider',
        apiEndpoint: 'not-a-url',
        apiKey: 'key',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty apiKey', () => {
      const result = createProviderSchema.safeParse({
        name: 'Provider',
        apiEndpoint: 'https://api.example.com',
        apiKey: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = createProviderSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateProviderSchema', () => {
    it('should accept all optional fields', () => {
      const result = updateProviderSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept partial update', () => {
      const result = updateProviderSchema.safeParse({ name: 'New Name', priority: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept isActive boolean', () => {
      const result = updateProviderSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('should reject invalid apiEndpoint', () => {
      const result = updateProviderSchema.safeParse({ apiEndpoint: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('providerIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = providerIdSchema.safeParse({
        providerId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID', () => {
      const result = providerIdSchema.safeParse({ providerId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('providersQuerySchema', () => {
    it('should apply defaults', () => {
      const result = providersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should coerce string page and limit', () => {
      const result = providersQuerySchema.safeParse({ page: '2', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept isActive filter', () => {
      const result = providersQuerySchema.safeParse({ isActive: 'true' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should reject page < 1', () => {
      const result = providersQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = providersQuerySchema.safeParse({ limit: '200' });
      expect(result.success).toBe(false);
    });
  });
});
