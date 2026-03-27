import Fastify, { type FastifyInstance } from 'fastify';
import { notificationRoutes } from '../notifications.routes';
import { AppError } from '../../../shared/errors/app-error';
import { NotFoundError } from '../../../shared/errors';

const mockListNotifications = jest.fn();
const mockGetNotification = jest.fn();

jest.mock('../notifications.service', () => ({
  listNotifications: (...args: unknown[]): unknown => mockListNotifications(...args),
  getNotification: (...args: unknown[]): unknown => mockGetNotification(...args),
}));

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../../auth/utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../../auth/token-store', () => ({
  isAccessTokenBlacklisted: (...args: unknown[]): unknown => mockIsBlacklisted(...args),
}));

jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const validUser = { userId: 'u1', email: 'a@b.com', role: 'USER', jti: 'jti-1' };

function withAuth(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(validUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer valid-token' };
}

describe('Notification Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(notificationRoutes, { prefix: '/notifications' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /notifications', () => {
    it('should return 200 with paginated notifications', async () => {
      const headers = withAuth();
      mockListNotifications.mockResolvedValue({
        notifications: [
          {
            id: 'n1',
            type: 'EMAIL',
            channel: 'test@test.com',
            subject: 'Test',
            status: 'SENT',
            eventType: 'order.created',
            createdAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
        headers,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.notifications).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      const headers = withAuth();
      mockListNotifications.mockResolvedValue({
        notifications: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({
        method: 'GET',
        url: '/notifications?page=2&limit=10&status=SENT',
        headers,
      });

      expect(mockListNotifications).toHaveBeenCalledWith('u1', {
        page: 2,
        limit: 10,
        status: 'SENT',
      });
    });

    it('should return 422 on invalid query params', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'GET',
        url: '/notifications?page=0',
        headers,
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on invalid status', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'GET',
        url: '/notifications?status=INVALID',
        headers,
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /notifications/:notificationId', () => {
    const notifId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with notification detail', async () => {
      const headers = withAuth();
      mockGetNotification.mockResolvedValue({
        id: notifId,
        userId: 'u1',
        type: 'EMAIL',
        channel: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
        status: 'SENT',
        eventType: 'order.created',
        referenceType: 'order',
        referenceId: 'order-1',
        sentAt: new Date(),
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
        headers,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(notifId);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'GET',
        url: '/notifications/not-a-uuid',
        headers,
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 404 when not found', async () => {
      const headers = withAuth();
      mockGetNotification.mockRejectedValue(
        new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND'),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
        headers,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
