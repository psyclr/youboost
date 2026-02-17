import {
  createNotification,
  findNotificationsByUserId,
  findNotificationById,
  updateNotificationStatus,
  incrementRetryCount,
} from '../notification.repository';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../shared/database', () => ({
  getPrisma: (): unknown => ({
    notification: {
      create: (...args: unknown[]): unknown => mockCreate(...args),
      findMany: (...args: unknown[]): unknown => mockFindMany(...args),
      count: (...args: unknown[]): unknown => mockCount(...args),
      findFirst: (...args: unknown[]): unknown => mockFindFirst(...args),
      update: (...args: unknown[]): unknown => mockUpdate(...args),
    },
  }),
}));

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'EMAIL',
  channel: 'test@test.com',
  subject: 'Test',
  body: 'Test body',
  status: 'PENDING',
  eventType: 'order.created',
  referenceType: 'order',
  referenceId: 'order-1',
  sentAt: null,
  failureReason: null,
  retryCount: 0,
  createdAt: new Date(),
};

describe('Notification Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create notification with PENDING status', async () => {
      mockCreate.mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: 'order-1',
      });

      expect(result.id).toBe('notif-1');
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'EMAIL',
          status: 'PENDING',
        }),
      });
    });

    it('should set null for optional fields when not provided', async () => {
      mockCreate.mockResolvedValue(mockNotification);

      await createNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: null,
          referenceType: null,
          referenceId: null,
        }),
      });
    });
  });

  describe('findNotificationsByUserId', () => {
    it('should return paginated notifications', async () => {
      mockFindMany.mockResolvedValue([mockNotification]);
      mockCount.mockResolvedValue(1);

      const result = await findNotificationsByUserId('user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findNotificationsByUserId('user-1', {
        status: 'SENT',
        page: 1,
        limit: 20,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'SENT' },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findNotificationsByUserId('user-1', { page: 3, limit: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should order by createdAt descending', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await findNotificationsByUserId('user-1', { page: 1, limit: 20 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findNotificationById', () => {
    it('should return notification by id', async () => {
      mockFindFirst.mockResolvedValue(mockNotification);

      const result = await findNotificationById('notif-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('notif-1');
    });

    it('should filter by userId when provided', async () => {
      mockFindFirst.mockResolvedValue(mockNotification);

      await findNotificationById('notif-1', 'user-1');

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
    });

    it('should return null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findNotificationById('notif-999');

      expect(result).toBeNull();
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update status to SENT and set sentAt', async () => {
      mockUpdate.mockResolvedValue({ ...mockNotification, status: 'SENT', sentAt: new Date() });

      await updateNotificationStatus('notif-1', 'SENT');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should update status to FAILED with reason', async () => {
      mockUpdate.mockResolvedValue({ ...mockNotification, status: 'FAILED' });

      await updateNotificationStatus('notif-1', 'FAILED', 'Connection refused');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: 'Connection refused',
        }),
      });
    });

    it('should not set sentAt for FAILED status', async () => {
      mockUpdate.mockResolvedValue({ ...mockNotification, status: 'FAILED' });

      await updateNotificationStatus('notif-1', 'FAILED');

      const callData = mockUpdate.mock.calls[0][0].data;
      expect(callData.sentAt).toBeUndefined();
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      mockUpdate.mockResolvedValue({ ...mockNotification, retryCount: 1 });

      const result = await incrementRetryCount('notif-1');

      expect(result.retryCount).toBe(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { retryCount: { increment: 1 } },
      });
    });
  });
});
