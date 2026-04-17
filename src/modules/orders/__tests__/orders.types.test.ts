import {
  createOrderSchema,
  ordersQuerySchema,
  orderIdSchema,
  bulkOrderSchema,
} from '../orders.types';

describe('Order Validation Schemas', () => {
  describe('createOrderSchema', () => {
    const valid = {
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      quantity: 1000,
    };

    it('should accept valid input', () => {
      expect(() => createOrderSchema.parse(valid)).not.toThrow();
    });

    it('should accept input with optional comments', () => {
      const result = createOrderSchema.parse({ ...valid, comments: 'Test comment' });
      expect(result.comments).toBe('Test comment');
    });

    it('should accept minimum quantity of 1', () => {
      expect(() => createOrderSchema.parse({ ...valid, quantity: 1 })).not.toThrow();
    });

    it('should reject quantity of 0', () => {
      expect(() => createOrderSchema.parse({ ...valid, quantity: 0 })).toThrow();
    });

    it('should reject negative quantity', () => {
      expect(() => createOrderSchema.parse({ ...valid, quantity: -5 })).toThrow();
    });

    it('should reject non-integer quantity', () => {
      expect(() => createOrderSchema.parse({ ...valid, quantity: 10.5 })).toThrow();
    });

    it('should reject invalid UUID for serviceId', () => {
      expect(() => createOrderSchema.parse({ ...valid, serviceId: 'not-a-uuid' })).toThrow();
    });

    it('should reject invalid URL for link', () => {
      expect(() => createOrderSchema.parse({ ...valid, link: 'not-a-url' })).toThrow();
    });

    it('should reject comments longer than 500 characters', () => {
      expect(() => createOrderSchema.parse({ ...valid, comments: 'x'.repeat(501) })).toThrow();
    });

    it('should accept comments of exactly 500 characters', () => {
      expect(() => createOrderSchema.parse({ ...valid, comments: 'x'.repeat(500) })).not.toThrow();
    });

    it('should accept input without comments', () => {
      const result = createOrderSchema.parse(valid);
      expect(result.comments).toBeUndefined();
    });
  });

  describe('createOrderSchema — string coercion', () => {
    const base = {
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    };

    it('should coerce string quantity to number', () => {
      const result = createOrderSchema.parse({ ...base, quantity: '500' });
      expect(result.quantity).toBe(500);
      expect(typeof result.quantity).toBe('number');
    });

    it('should coerce string dripFeed fields to numbers', () => {
      const result = createOrderSchema.parse({
        ...base,
        quantity: '100',
        isDripFeed: true,
        dripFeedRuns: '5',
        dripFeedInterval: '60',
      });
      expect(result.dripFeedRuns).toBe(5);
      expect(result.dripFeedInterval).toBe(60);
    });

    it('should still reject non-numeric strings', () => {
      expect(() => createOrderSchema.parse({ ...base, quantity: 'abc' })).toThrow();
    });

    it('should still reject string "0"', () => {
      expect(() => createOrderSchema.parse({ ...base, quantity: '0' })).toThrow();
    });
  });

  describe('bulkOrderSchema — string coercion', () => {
    const base = {
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      links: [{ link: 'https://youtube.com/watch?v=abc' }],
    };

    it('should coerce string defaultQuantity to number', () => {
      const result = bulkOrderSchema.parse({ ...base, defaultQuantity: '1000' });
      expect(result.defaultQuantity).toBe(1000);
      expect(typeof result.defaultQuantity).toBe('number');
    });

    it('should coerce nested link quantity from string', () => {
      const result = bulkOrderSchema.parse({
        ...base,
        defaultQuantity: 100,
        links: [{ link: 'https://youtube.com/watch?v=abc', quantity: '200' }],
      });
      expect(result.links[0]?.quantity).toBe(200);
    });
  });

  describe('ordersQuerySchema', () => {
    it('should accept empty object with defaults', () => {
      const result = ordersQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string numbers', () => {
      const result = ordersQuerySchema.parse({ page: '2', limit: '50' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should accept valid status filter', () => {
      const result = ordersQuerySchema.parse({ status: 'PENDING' });
      expect(result.status).toBe('PENDING');
    });

    it('should accept all valid order statuses', () => {
      for (const status of [
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'PARTIAL',
        'CANCELLED',
        'FAILED',
        'REFUNDED',
      ]) {
        expect(() => ordersQuerySchema.parse({ status })).not.toThrow();
      }
    });

    it('should reject invalid status', () => {
      expect(() => ordersQuerySchema.parse({ status: 'INVALID' })).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() => ordersQuerySchema.parse({ page: 0 })).toThrow();
    });

    it('should reject limit above 100', () => {
      expect(() => ordersQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should accept optional serviceId filter', () => {
      const result = ordersQuerySchema.parse({ serviceId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.serviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid UUID for serviceId', () => {
      expect(() => ordersQuerySchema.parse({ serviceId: 'not-a-uuid' })).toThrow();
    });
  });

  describe('orderIdSchema', () => {
    it('should accept valid UUID', () => {
      expect(() =>
        orderIdSchema.parse({ orderId: '550e8400-e29b-41d4-a716-446655440000' }),
      ).not.toThrow();
    });

    it('should reject non-UUID string', () => {
      expect(() => orderIdSchema.parse({ orderId: 'not-a-uuid' })).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => orderIdSchema.parse({ orderId: '' })).toThrow();
    });
  });
});
