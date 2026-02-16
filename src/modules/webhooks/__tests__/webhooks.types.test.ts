import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdSchema,
  webhooksQuerySchema,
  WEBHOOK_EVENTS,
} from '../webhooks.types';

describe('Webhook Types', () => {
  describe('WEBHOOK_EVENTS', () => {
    it('should contain all expected events', () => {
      expect(WEBHOOK_EVENTS).toContain('order.created');
      expect(WEBHOOK_EVENTS).toContain('order.completed');
      expect(WEBHOOK_EVENTS).toContain('order.failed');
      expect(WEBHOOK_EVENTS).toContain('order.partial');
      expect(WEBHOOK_EVENTS).toContain('order.cancelled');
    });
  });

  describe('createWebhookSchema', () => {
    it('should validate valid input', () => {
      const result = createWebhookSchema.safeParse({
        url: 'https://example.com/webhook',
        events: ['order.created'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = createWebhookSchema.safeParse({
        url: 'not-a-url',
        events: ['order.created'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty events array', () => {
      const result = createWebhookSchema.safeParse({
        url: 'https://example.com/webhook',
        events: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid event type', () => {
      const result = createWebhookSchema.safeParse({
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept multiple valid events', () => {
      const result = createWebhookSchema.safeParse({
        url: 'https://example.com/webhook',
        events: ['order.created', 'order.completed', 'order.failed'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateWebhookSchema', () => {
    it('should validate partial update with url only', () => {
      const result = updateWebhookSchema.safeParse({ url: 'https://new.com/hook' });
      expect(result.success).toBe(true);
    });

    it('should validate partial update with isActive', () => {
      const result = updateWebhookSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL on update', () => {
      const result = updateWebhookSchema.safeParse({ url: 'bad' });
      expect(result.success).toBe(false);
    });

    it('should accept empty object', () => {
      const result = updateWebhookSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('webhookIdSchema', () => {
    it('should validate a valid UUID', () => {
      const result = webhookIdSchema.safeParse({
        webhookId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = webhookIdSchema.safeParse({ webhookId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('webhooksQuerySchema', () => {
    it('should apply defaults', () => {
      const result = webhooksQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject page less than 1', () => {
      const result = webhooksQuerySchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = webhooksQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });

    it('should parse isActive boolean string', () => {
      const result = webhooksQuerySchema.safeParse({ isActive: 'true' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });
  });
});
