import {
  adminUsersQuerySchema,
  adminUserIdSchema,
  adminUpdateUserSchema,
  adminBalanceAdjustSchema,
  adminOrdersQuerySchema,
  adminOrderIdSchema,
  adminForceStatusSchema,
  adminServiceCreateSchema,
  adminServiceUpdateSchema,
  adminServiceIdSchema,
} from '../admin.types';

describe('Admin Types - Zod Schemas', () => {
  describe('adminUsersQuerySchema', () => {
    it('should parse valid query with defaults', () => {
      const result = adminUsersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should parse query with all filters', () => {
      const result = adminUsersQuerySchema.safeParse({
        page: '2',
        limit: '10',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('ADMIN');
        expect(result.data.status).toBe('ACTIVE');
      }
    });

    it('should reject invalid role', () => {
      const result = adminUsersQuerySchema.safeParse({ role: 'SUPERADMIN' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = adminUsersQuerySchema.safeParse({ status: 'DELETED' });
      expect(result.success).toBe(false);
    });

    it('should reject page < 1', () => {
      const result = adminUsersQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = adminUsersQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminUserIdSchema', () => {
    it('should parse valid UUID', () => {
      const result = adminUserIdSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID', () => {
      const result = adminUserIdSchema.safeParse({ userId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminUpdateUserSchema', () => {
    it('should parse role update', () => {
      const result = adminUpdateUserSchema.safeParse({ role: 'RESELLER' });
      expect(result.success).toBe(true);
    });

    it('should parse status update', () => {
      const result = adminUpdateUserSchema.safeParse({ status: 'SUSPENDED' });
      expect(result.success).toBe(true);
    });

    it('should parse empty object', () => {
      const result = adminUpdateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = adminUpdateUserSchema.safeParse({ role: 'GOD' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const result = adminUpdateUserSchema.safeParse({ status: 'DELETED' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminBalanceAdjustSchema', () => {
    it('should parse positive amount', () => {
      const result = adminBalanceAdjustSchema.safeParse({ amount: 100, reason: 'Bonus' });
      expect(result.success).toBe(true);
    });

    it('should parse negative amount', () => {
      const result = adminBalanceAdjustSchema.safeParse({ amount: -50, reason: 'Penalty' });
      expect(result.success).toBe(true);
    });

    it('should reject missing reason', () => {
      const result = adminBalanceAdjustSchema.safeParse({ amount: 100 });
      expect(result.success).toBe(false);
    });

    it('should reject empty reason', () => {
      const result = adminBalanceAdjustSchema.safeParse({ amount: 100, reason: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const result = adminBalanceAdjustSchema.safeParse({ reason: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminOrdersQuerySchema', () => {
    it('should parse defaults', () => {
      const result = adminOrdersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should parse with status filter', () => {
      const result = adminOrdersQuerySchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(true);
    });

    it('should parse with userId filter', () => {
      const result = adminOrdersQuerySchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = adminOrdersQuerySchema.safeParse({ status: 'UNKNOWN' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid userId', () => {
      const result = adminOrdersQuerySchema.safeParse({ userId: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminOrderIdSchema', () => {
    it('should parse valid UUID', () => {
      const result = adminOrderIdSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID', () => {
      const result = adminOrderIdSchema.safeParse({ orderId: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminForceStatusSchema', () => {
    it('should parse valid status', () => {
      const result = adminForceStatusSchema.safeParse({ status: 'COMPLETED' });
      expect(result.success).toBe(true);
    });

    it('should parse all statuses', () => {
      const statuses = [
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'PARTIAL',
        'CANCELLED',
        'FAILED',
        'REFUNDED',
      ];
      for (const status of statuses) {
        const result = adminForceStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = adminForceStatusSchema.safeParse({ status: 'UNKNOWN' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminServiceCreateSchema', () => {
    const validService = {
      name: 'YouTube Views',
      platform: 'YOUTUBE',
      type: 'VIEWS',
      pricePer1000: 5.99,
      minQuantity: 100,
      maxQuantity: 100000,
    };

    it('should parse valid service', () => {
      const result = adminServiceCreateSchema.safeParse(validService);
      expect(result.success).toBe(true);
    });

    it('should parse with optional description', () => {
      const result = adminServiceCreateSchema.safeParse({
        ...validService,
        description: 'Fast delivery',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = adminServiceCreateSchema.safeParse({ ...validService, name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid platform', () => {
      const result = adminServiceCreateSchema.safeParse({ ...validService, platform: 'LINKEDIN' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const result = adminServiceCreateSchema.safeParse({ ...validService, type: 'FOLLOWERS' });
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const result = adminServiceCreateSchema.safeParse({ ...validService, pricePer1000: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject minQuantity < 1', () => {
      const result = adminServiceCreateSchema.safeParse({ ...validService, minQuantity: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('adminServiceUpdateSchema', () => {
    it('should parse partial update', () => {
      const result = adminServiceUpdateSchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('should parse empty object', () => {
      const result = adminServiceUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should parse isActive update', () => {
      const result = adminServiceUpdateSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('should reject invalid platform', () => {
      const result = adminServiceUpdateSchema.safeParse({ platform: 'BADPLATFORM' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminServiceIdSchema', () => {
    it('should parse valid UUID', () => {
      const result = adminServiceIdSchema.safeParse({
        serviceId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID', () => {
      const result = adminServiceIdSchema.safeParse({ serviceId: 'bad' });
      expect(result.success).toBe(false);
    });
  });
});
