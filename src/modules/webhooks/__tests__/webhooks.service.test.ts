import { createWebhooksService } from '../webhooks.service';
import { createFakeWebhooksRepository, silentLogger } from './fakes';
import type { WebhookRecord } from '../webhooks.types';

function makeRecord(overrides: Partial<WebhookRecord> = {}): WebhookRecord {
  return {
    id: 'wh-seed',
    userId: 'user-1',
    url: 'https://example.com/hook',
    events: ['order.created'],
    secret: 'secret123',
    isActive: true,
    lastTriggeredAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Webhooks Service', () => {
  describe('createWebhook', () => {
    it('should create webhook with generated secret', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created'],
      });

      expect(result.id).toBe('wh-1');
      expect(webhooksRepo.calls.createWebhook).toHaveLength(1);
      expect(webhooksRepo.calls.createWebhook[0]).toMatchObject({
        userId: 'user-1',
        url: 'https://example.com/hook',
        events: ['order.created'],
      });
      expect(webhooksRepo.calls.createWebhook[0]?.secret).toEqual(expect.any(String));
    });

    it('should not expose secret in response', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created'],
      });

      expect((result as unknown as Record<string, unknown>).secret).toBeUndefined();
    });

    it('should pass events to repository', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created', 'order.completed'],
      });

      expect(webhooksRepo.calls.createWebhook[0]?.events).toEqual([
        'order.created',
        'order.completed',
      ]);
    });

    it('should generate a 64-char hex secret', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created'],
      });

      const secret = webhooksRepo.calls.createWebhook[0]?.secret ?? '';
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('listWebhooks', () => {
    it('should return paginated webhooks', async () => {
      const record = makeRecord({ id: 'wh-seed-1' });
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [record] });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.listWebhooks('user-1', { page: 1, limit: 20 });

      expect(result.webhooks).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      const records = Array.from({ length: 45 }, (_, i) => makeRecord({ id: `wh-seed-${i}` }));
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: records });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.listWebhooks('user-1', { page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.total).toBe(45);
    });

    it('should pass isActive filter to repository', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.listWebhooks('user-1', { page: 2, limit: 10, isActive: true });

      expect(webhooksRepo.calls.findWebhooksByUserId).toEqual([
        { userId: 'user-1', filters: { isActive: true, page: 2, limit: 10 } },
      ]);
    });

    it('should omit isActive when not provided', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.listWebhooks('user-1', { page: 1, limit: 20 });

      expect(webhooksRepo.calls.findWebhooksByUserId).toEqual([
        { userId: 'user-1', filters: { page: 1, limit: 20 } },
      ]);
    });
  });

  describe('getWebhook', () => {
    it('should return webhook by id', async () => {
      const record = makeRecord({ id: 'wh-seed-1' });
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [record] });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.getWebhook('user-1', 'wh-seed-1');

      expect(result.id).toBe('wh-seed-1');
    });

    it('should throw NotFoundError when not found', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await expect(service.getWebhook('user-1', 'bad')).rejects.toThrow('Webhook not found');
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook', async () => {
      const record = makeRecord({ id: 'wh-seed-1' });
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [record] });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      const result = await service.updateWebhook('user-1', 'wh-seed-1', {
        url: 'https://new.com',
      });

      expect(result.url).toBe('https://new.com');
    });

    it('should throw NotFoundError when not found', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await expect(
        service.updateWebhook('user-1', 'bad', { url: 'https://x.com' }),
      ).rejects.toThrow('Webhook not found');
    });

    it('should pass only defined fields to repository', async () => {
      const record = makeRecord({ id: 'wh-seed-1' });
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [record] });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.updateWebhook('user-1', 'wh-seed-1', { isActive: false });

      expect(webhooksRepo.calls.updateWebhook).toEqual([
        { webhookId: 'wh-seed-1', userId: 'user-1', data: { isActive: false } },
      ]);
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      const record = makeRecord({ id: 'wh-seed-1' });
      const webhooksRepo = createFakeWebhooksRepository({ webhooks: [record] });
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await service.deleteWebhook('user-1', 'wh-seed-1');

      expect(webhooksRepo.calls.deleteWebhook).toEqual([
        { webhookId: 'wh-seed-1', userId: 'user-1' },
      ]);
    });

    it('should throw NotFoundError when not found', async () => {
      const webhooksRepo = createFakeWebhooksRepository();
      const service = createWebhooksService({ webhooksRepo, logger: silentLogger });

      await expect(service.deleteWebhook('user-1', 'bad')).rejects.toThrow('Webhook not found');
    });
  });
});
