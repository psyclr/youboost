import { notificationsQuerySchema, notificationIdSchema } from '../notifications.types';

describe('Notification Types', () => {
  describe('notificationsQuerySchema', () => {
    it('should accept valid query with defaults', () => {
      const result = notificationsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept custom page and limit', () => {
      const result = notificationsQuerySchema.safeParse({ page: '3', limit: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept valid status filter', () => {
      const result = notificationsQuerySchema.safeParse({ status: 'SENT' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('SENT');
      }
    });

    it('should accept PENDING status', () => {
      const result = notificationsQuerySchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(true);
    });

    it('should accept FAILED status', () => {
      const result = notificationsQuerySchema.safeParse({ status: 'FAILED' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = notificationsQuerySchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject page below 1', () => {
      const result = notificationsQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = notificationsQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should reject limit below 1', () => {
      const result = notificationsQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('should coerce string numbers', () => {
      const result = notificationsQuerySchema.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });
  });

  describe('notificationIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = notificationIdSchema.safeParse({
        notificationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = notificationIdSchema.safeParse({ notificationId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing notificationId', () => {
      const result = notificationIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = notificationIdSchema.safeParse({ notificationId: '' });
      expect(result.success).toBe(false);
    });
  });
});
