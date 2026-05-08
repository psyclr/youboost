import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError, NotFoundError } from '../../../shared/errors';
import { createNotificationRoutes } from '../notifications.routes';
import type { NotificationsService } from '../notifications.service';
import type { AuthenticatedUser } from '../../auth';

function createFakeService(): NotificationsService & {
  calls: {
    sendNotification: unknown[];
    listNotifications: unknown[];
    getNotification: unknown[];
  };
  responses: {
    sendNotification: unknown;
    listNotifications: unknown;
    getNotification: unknown | (() => unknown);
  };
} {
  const calls = {
    sendNotification: [] as unknown[],
    listNotifications: [] as unknown[],
    getNotification: [] as unknown[],
  };
  const responses: {
    sendNotification: unknown;
    listNotifications: unknown;
    getNotification: unknown | (() => unknown);
  } = {
    sendNotification: {},
    listNotifications: {
      notifications: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    getNotification: {},
  };
  return {
    async sendNotification(input) {
      calls.sendNotification.push(input);
      return responses.sendNotification as never;
    },
    async listNotifications(userId, query) {
      calls.listNotifications.push({ userId, query });
      return responses.listNotifications as never;
    },
    async getNotification(id, userId) {
      calls.getNotification.push({ id, userId });
      const r = responses.getNotification;
      if (typeof r === 'function') return (r as () => never)();
      return r as never;
    },
    calls,
    responses,
  };
}

const testUser: AuthenticatedUser = {
  userId: 'u1',
  email: 'a@b.com',
  role: 'USER',
  jti: 'jti-1',
};

interface AuthState {
  userHeader: string | null;
}

function buildApp(state: AuthState, service: NotificationsService): FastifyInstance {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  });
  const authenticate = async (req: FastifyRequest): Promise<void> => {
    if (!state.userHeader) {
      throw new UnauthorizedError('Missing token', 'MISSING_TOKEN');
    }
    req.user = testUser;
  };
  return app.register(createNotificationRoutes({ service, authenticate }), {
    prefix: '/notifications',
  }) as unknown as FastifyInstance;
}

describe('Notification Routes', () => {
  describe('GET /notifications', () => {
    it('should return 200 with paginated notifications', async () => {
      const service = createFakeService();
      service.responses.listNotifications = {
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
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.notifications).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
      await app.close();
    });

    it('should pass query params to service', async () => {
      const service = createFakeService();
      service.responses.listNotifications = {
        notifications: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      await app.inject({
        method: 'GET',
        url: '/notifications?page=2&limit=10&status=SENT',
        headers: { authorization: 'Bearer valid' },
      });

      expect(service.calls.listNotifications).toEqual([
        { userId: 'u1', query: { page: 2, limit: 10, status: 'SENT' } },
      ]);
      await app.close();
    });

    it('should return 422 on invalid query params', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/notifications?page=0',
        headers: { authorization: 'Bearer valid' },
      });
      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 422 on invalid status', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/notifications?status=INVALID',
        headers: { authorization: 'Bearer valid' },
      });
      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('GET /notifications/:notificationId', () => {
    const notifId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 with notification detail', async () => {
      const service = createFakeService();
      service.responses.getNotification = {
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
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(notifId);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/notifications/not-a-uuid',
        headers: { authorization: 'Bearer valid' },
      });
      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('should return 404 when not found', async () => {
      const service = createFakeService();
      service.responses.getNotification = () => {
        throw new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/notifications/${notifId}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });
});
