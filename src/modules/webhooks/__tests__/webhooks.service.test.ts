import {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
} from '../webhooks.service';

const mockCreateWebhook = jest.fn();
const mockFindWebhooksByUserId = jest.fn();
const mockFindWebhookById = jest.fn();
const mockUpdateWebhook = jest.fn();
const mockDeleteWebhook = jest.fn();

jest.mock('../webhooks.repository', () => ({
  createWebhook: (...args: unknown[]): unknown => mockCreateWebhook(...args),
  findWebhooksByUserId: (...args: unknown[]): unknown => mockFindWebhooksByUserId(...args),
  findWebhookById: (...args: unknown[]): unknown => mockFindWebhookById(...args),
  updateWebhook: (...args: unknown[]): unknown => mockUpdateWebhook(...args),
  deleteWebhook: (...args: unknown[]): unknown => mockDeleteWebhook(...args),
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
  id: 'wh-1',
  userId: 'user-1',
  url: 'https://example.com/hook',
  events: ['order.created'],
  secret: 'secret',
  isActive: true,
  lastTriggeredAt: null,
  createdAt: new Date(),
};

describe('Webhooks Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createWebhook', () => {
    it('should create webhook with generated secret', async () => {
      mockCreateWebhook.mockResolvedValue(mockRecord);
      const result = await createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created'],
      });
      expect(result.id).toBe('wh-1');
      expect(mockCreateWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', secret: expect.any(String) }),
      );
    });

    it('should not expose secret in response', async () => {
      mockCreateWebhook.mockResolvedValue(mockRecord);
      const result = await createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created'],
      });
      expect((result as unknown as Record<string, unknown>).secret).toBeUndefined();
    });

    it('should pass events to repository', async () => {
      mockCreateWebhook.mockResolvedValue(mockRecord);
      await createWebhook('user-1', {
        url: 'https://example.com/hook',
        events: ['order.created', 'order.completed'],
      });
      expect(mockCreateWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ events: ['order.created', 'order.completed'] }),
      );
    });
  });

  describe('listWebhooks', () => {
    it('should return paginated webhooks', async () => {
      mockFindWebhooksByUserId.mockResolvedValue({ webhooks: [mockRecord], total: 1 });
      const result = await listWebhooks('user-1', { page: 1, limit: 20 });
      expect(result.webhooks).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      mockFindWebhooksByUserId.mockResolvedValue({ webhooks: [], total: 45 });
      const result = await listWebhooks('user-1', { page: 1, limit: 20 });
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should pass filters to repository', async () => {
      mockFindWebhooksByUserId.mockResolvedValue({ webhooks: [], total: 0 });
      await listWebhooks('user-1', { page: 2, limit: 10, isActive: true });
      expect(mockFindWebhooksByUserId).toHaveBeenCalledWith('user-1', {
        isActive: true,
        page: 2,
        limit: 10,
      });
    });
  });

  describe('getWebhook', () => {
    it('should return webhook by id', async () => {
      mockFindWebhookById.mockResolvedValue(mockRecord);
      const result = await getWebhook('user-1', 'wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundError when not found', async () => {
      mockFindWebhookById.mockResolvedValue(null);
      await expect(getWebhook('user-1', 'bad')).rejects.toThrow('Webhook not found');
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook', async () => {
      mockFindWebhookById.mockResolvedValue(mockRecord);
      mockUpdateWebhook.mockResolvedValue({ ...mockRecord, url: 'https://new.com' });
      const result = await updateWebhook('user-1', 'wh-1', { url: 'https://new.com' });
      expect(result.url).toBe('https://new.com');
    });

    it('should throw NotFoundError when not found', async () => {
      mockFindWebhookById.mockResolvedValue(null);
      await expect(updateWebhook('user-1', 'bad', { url: 'https://x.com' })).rejects.toThrow(
        'Webhook not found',
      );
    });

    it('should pass only defined fields to repository', async () => {
      mockFindWebhookById.mockResolvedValue(mockRecord);
      mockUpdateWebhook.mockResolvedValue(mockRecord);
      await updateWebhook('user-1', 'wh-1', { isActive: false });
      expect(mockUpdateWebhook).toHaveBeenCalledWith('wh-1', 'user-1', { isActive: false });
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      mockFindWebhookById.mockResolvedValue(mockRecord);
      mockDeleteWebhook.mockResolvedValue(undefined);
      await deleteWebhook('user-1', 'wh-1');
      expect(mockDeleteWebhook).toHaveBeenCalledWith('wh-1', 'user-1');
    });

    it('should throw NotFoundError when not found', async () => {
      mockFindWebhookById.mockResolvedValue(null);
      await expect(deleteWebhook('user-1', 'bad')).rejects.toThrow('Webhook not found');
    });
  });
});
