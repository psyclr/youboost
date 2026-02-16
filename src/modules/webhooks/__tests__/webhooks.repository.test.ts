import {
  createWebhook,
  findWebhooksByUserId,
  findWebhookById,
  updateWebhook,
  deleteWebhook,
  findActiveWebhooksByEvent,
  updateLastTriggeredAt,
} from '../webhooks.repository';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: jest.fn().mockReturnValue({
    webhook: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
      delete: (...args: unknown[]): unknown => mockDelete(...args),
    },
  }),
}));

const mockRecord = {
  id: 'wh-1',
  userId: 'user-1',
  url: 'https://example.com/hook',
  events: ['order.created'],
  secret: 'secret123',
  isActive: true,
  lastTriggeredAt: null,
  createdAt: new Date(),
};

describe('Webhooks Repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createWebhook', () => {
    it('should create a webhook', async () => {
      mockCreate.mockResolvedValue(mockRecord);
      const result = await createWebhook({
        userId: 'user-1',
        url: 'https://example.com/hook',
        events: ['order.created'],
        secret: 'secret123',
      });
      expect(result).toEqual(mockRecord);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', url: 'https://example.com/hook' }),
      });
    });
  });

  describe('findWebhooksByUserId', () => {
    it('should return paginated results', async () => {
      mockFindMany.mockResolvedValue([mockRecord]);
      mockCount.mockResolvedValue(1);
      const result = await findWebhooksByUserId('user-1', { page: 1, limit: 20 });
      expect(result.webhooks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findWebhooksByUserId('user-1', { page: 1, limit: 20, isActive: true });
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', isActive: true } }),
      );
    });

    it('should apply pagination offset', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      await findWebhooksByUserId('user-1', { page: 3, limit: 10 });
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });
  });

  describe('findWebhookById', () => {
    it('should find webhook scoped by userId', async () => {
      mockFindFirst.mockResolvedValue(mockRecord);
      const result = await findWebhookById('wh-1', 'user-1');
      expect(result).toEqual(mockRecord);
      expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'wh-1', userId: 'user-1' } });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      const result = await findWebhookById('bad', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook fields', async () => {
      mockFindFirst.mockResolvedValue(mockRecord);
      mockUpdate.mockResolvedValue({ ...mockRecord, url: 'https://new.com' });
      const result = await updateWebhook('wh-1', 'user-1', { url: 'https://new.com' });
      expect(result.url).toBe('https://new.com');
    });

    it('should throw when webhook not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(updateWebhook('bad', 'user-1', { url: 'https://x.com' })).rejects.toThrow();
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook', async () => {
      mockFindFirst.mockResolvedValue(mockRecord);
      mockDelete.mockResolvedValue(mockRecord);
      await deleteWebhook('wh-1', 'user-1');
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
    });

    it('should throw when webhook not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(deleteWebhook('bad', 'user-1')).rejects.toThrow();
    });
  });

  describe('findActiveWebhooksByEvent', () => {
    it('should find active webhooks matching event', async () => {
      mockFindMany.mockResolvedValue([mockRecord]);
      const result = await findActiveWebhooksByEvent('user-1', 'order.created');
      expect(result).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true, events: { has: 'order.created' } },
      });
    });
  });

  describe('updateLastTriggeredAt', () => {
    it('should update lastTriggeredAt timestamp', async () => {
      mockUpdate.mockResolvedValue(mockRecord);
      await updateLastTriggeredAt('wh-1');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'wh-1' },
        data: { lastTriggeredAt: expect.any(Date) },
      });
    });
  });
});
