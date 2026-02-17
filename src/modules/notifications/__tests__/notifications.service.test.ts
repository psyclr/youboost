import { sendNotification, listNotifications, getNotification } from '../notifications.service';

const mockCreateNotification = jest.fn();
const mockFindNotificationsByUserId = jest.fn();
const mockFindNotificationById = jest.fn();

jest.mock('../notification.repository', () => ({
  createNotification: (...args: unknown[]): unknown => mockCreateNotification(...args),
  findNotificationsByUserId: (...args: unknown[]): unknown =>
    mockFindNotificationsByUserId(...args),
  findNotificationById: (...args: unknown[]): unknown => mockFindNotificationById(...args),
}));

const mockEnqueue = jest.fn();
jest.mock('../notification-dispatcher', () => ({
  enqueueNotification: (...args: unknown[]): unknown => mockEnqueue(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'EMAIL',
  channel: 'test@test.com',
  subject: 'Test Subject',
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

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockResolvedValue(undefined);
  });

  describe('sendNotification', () => {
    it('should create notification and enqueue', async () => {
      mockCreateNotification.mockResolvedValue(mockNotification);

      const result = await sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test Subject',
        body: 'Test body',
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: 'order-1',
      });

      expect(result.id).toBe('notif-1');
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'EMAIL',
          channel: 'test@test.com',
        }),
      );
      expect(mockEnqueue).toHaveBeenCalledWith('notif-1');
    });

    it('should pass null for optional fields when not provided', async () => {
      mockCreateNotification.mockResolvedValue(mockNotification);

      await sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: null,
          referenceType: null,
          referenceId: null,
        }),
      );
    });

    it('should return the created notification record', async () => {
      mockCreateNotification.mockResolvedValue(mockNotification);

      const result = await sendNotification({
        userId: 'user-1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Body',
      });

      expect(result.status).toBe('PENDING');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('listNotifications', () => {
    it('should return paginated notifications', async () => {
      mockFindNotificationsByUserId.mockResolvedValue({
        notifications: [mockNotification],
        total: 1,
      });

      const result = await listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should pass status filter', async () => {
      mockFindNotificationsByUserId.mockResolvedValue({
        notifications: [],
        total: 0,
      });

      await listNotifications('user-1', { page: 1, limit: 20, status: 'SENT' });

      expect(mockFindNotificationsByUserId).toHaveBeenCalledWith('user-1', {
        status: 'SENT',
        page: 1,
        limit: 20,
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockFindNotificationsByUserId.mockResolvedValue({
        notifications: [],
        total: 45,
      });

      const result = await listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should return empty array when no notifications', async () => {
      mockFindNotificationsByUserId.mockResolvedValue({
        notifications: [],
        total: 0,
      });

      const result = await listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should map notification fields correctly', async () => {
      mockFindNotificationsByUserId.mockResolvedValue({
        notifications: [mockNotification],
        total: 1,
      });

      const result = await listNotifications('user-1', { page: 1, limit: 20 });

      expect(result.notifications[0]).toEqual(
        expect.objectContaining({
          id: 'notif-1',
          type: 'EMAIL',
          channel: 'test@test.com',
          subject: 'Test Subject',
          status: 'PENDING',
          eventType: 'order.created',
        }),
      );
    });
  });

  describe('getNotification', () => {
    it('should return notification by id and userId', async () => {
      mockFindNotificationById.mockResolvedValue(mockNotification);

      const result = await getNotification('notif-1', 'user-1');

      expect(result.id).toBe('notif-1');
      expect(mockFindNotificationById).toHaveBeenCalledWith('notif-1', 'user-1');
    });

    it('should throw NotFoundError when not found', async () => {
      mockFindNotificationById.mockResolvedValue(null);

      await expect(getNotification('notif-999', 'user-1')).rejects.toThrow(
        'Notification not found',
      );
    });

    it('should return full notification record', async () => {
      mockFindNotificationById.mockResolvedValue(mockNotification);

      const result = await getNotification('notif-1', 'user-1');

      expect(result.body).toBe('Test body');
      expect(result.retryCount).toBe(0);
    });
  });
});
