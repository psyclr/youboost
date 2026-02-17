import { catalogQuerySchema, catalogServiceIdSchema } from '../catalog.types';

describe('Catalog Types', () => {
  describe('catalogQuerySchema', () => {
    it('should apply defaults for empty input', () => {
      const result = catalogQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.platform).toBeUndefined();
        expect(result.data.type).toBeUndefined();
      }
    });

    it('should coerce string page and limit', () => {
      const result = catalogQuerySchema.safeParse({ page: '3', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept valid platform filter', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'YOUTUBE' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platform).toBe('YOUTUBE');
      }
    });

    it('should accept valid type filter', () => {
      const result = catalogQuerySchema.safeParse({ type: 'VIEWS' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('VIEWS');
      }
    });

    it('should accept INSTAGRAM platform', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'INSTAGRAM' });
      expect(result.success).toBe(true);
    });

    it('should accept TIKTOK platform', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'TIKTOK' });
      expect(result.success).toBe(true);
    });

    it('should accept TWITTER platform', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'TWITTER' });
      expect(result.success).toBe(true);
    });

    it('should accept FACEBOOK platform', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'FACEBOOK' });
      expect(result.success).toBe(true);
    });

    it('should accept SUBSCRIBERS type', () => {
      const result = catalogQuerySchema.safeParse({ type: 'SUBSCRIBERS' });
      expect(result.success).toBe(true);
    });

    it('should accept LIKES type', () => {
      const result = catalogQuerySchema.safeParse({ type: 'LIKES' });
      expect(result.success).toBe(true);
    });

    it('should accept COMMENTS type', () => {
      const result = catalogQuerySchema.safeParse({ type: 'COMMENTS' });
      expect(result.success).toBe(true);
    });

    it('should accept SHARES type', () => {
      const result = catalogQuerySchema.safeParse({ type: 'SHARES' });
      expect(result.success).toBe(true);
    });

    it('should accept combined platform and type', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'YOUTUBE', type: 'VIEWS' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platform).toBe('YOUTUBE');
        expect(result.data.type).toBe('VIEWS');
      }
    });

    it('should reject invalid platform', () => {
      const result = catalogQuerySchema.safeParse({ platform: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const result = catalogQuerySchema.safeParse({ type: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject page < 1', () => {
      const result = catalogQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const result = catalogQuerySchema.safeParse({ page: '-1' });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = catalogQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject limit < 1', () => {
      const result = catalogQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer page', () => {
      const result = catalogQuerySchema.safeParse({ page: '1.5' });
      expect(result.success).toBe(false);
    });
  });

  describe('catalogServiceIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = catalogServiceIdSchema.safeParse({
        serviceId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.serviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should reject non-UUID string', () => {
      const result = catalogServiceIdSchema.safeParse({ serviceId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing serviceId', () => {
      const result = catalogServiceIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = catalogServiceIdSchema.safeParse({ serviceId: '' });
      expect(result.success).toBe(false);
    });
  });
});
