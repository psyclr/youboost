import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError, NotFoundError } from '../../../shared/errors';
import { createWebhookRoutes } from '../webhooks.routes';
import type { WebhooksService } from '../webhooks.service';
import type { AuthenticatedUser } from '../../auth';

function createFakeService(): WebhooksService & {
  calls: {
    createWebhook: unknown[];
    listWebhooks: unknown[];
    getWebhook: unknown[];
    updateWebhook: unknown[];
    deleteWebhook: unknown[];
  };
  responses: {
    createWebhook: unknown;
    listWebhooks: unknown;
    getWebhook: unknown | (() => unknown);
    updateWebhook: unknown;
    deleteWebhook: unknown | (() => unknown);
  };
} {
  const calls = {
    createWebhook: [] as unknown[],
    listWebhooks: [] as unknown[],
    getWebhook: [] as unknown[],
    updateWebhook: [] as unknown[],
    deleteWebhook: [] as unknown[],
  };
  const responses: {
    createWebhook: unknown;
    listWebhooks: unknown;
    getWebhook: unknown | (() => unknown);
    updateWebhook: unknown;
    deleteWebhook: unknown | (() => unknown);
  } = {
    createWebhook: {},
    listWebhooks: {
      webhooks: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    getWebhook: {},
    updateWebhook: {},
    deleteWebhook: undefined,
  };
  return {
    async createWebhook(userId, input) {
      calls.createWebhook.push({ userId, input });
      return responses.createWebhook as never;
    },
    async listWebhooks(userId, query) {
      calls.listWebhooks.push({ userId, query });
      return responses.listWebhooks as never;
    },
    async getWebhook(userId, webhookId) {
      calls.getWebhook.push({ userId, webhookId });
      const r = responses.getWebhook;
      if (typeof r === 'function') return (r as () => never)();
      return r as never;
    },
    async updateWebhook(userId, webhookId, input) {
      calls.updateWebhook.push({ userId, webhookId, input });
      return responses.updateWebhook as never;
    },
    async deleteWebhook(userId, webhookId) {
      calls.deleteWebhook.push({ userId, webhookId });
      const r = responses.deleteWebhook;
      if (typeof r === 'function') return (r as () => never)();
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

function buildApp(state: AuthState, service: WebhooksService): FastifyInstance {
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
  return app.register(createWebhookRoutes({ service, authenticate }), {
    prefix: '/webhooks',
  }) as unknown as FastifyInstance;
}

const webhookId = '550e8400-e29b-41d4-a716-446655440000';

describe('Webhook Routes', () => {
  describe('POST /webhooks', () => {
    const validPayload = { url: 'https://example.com/hook', events: ['order.created'] };

    it('should return 201 on valid input', async () => {
      const service = createFakeService();
      service.responses.createWebhook = {
        id: 'wh-1',
        url: validPayload.url,
        events: validPayload.events,
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: { authorization: 'Bearer valid' },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      await app.close();
    });

    it('should return 422 on invalid URL', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: { authorization: 'Bearer valid' },
        payload: { url: 'bad', events: ['order.created'] },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 422 on empty events', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: { authorization: 'Bearer valid' },
        payload: { url: 'https://x.com', events: [] },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'POST', url: '/webhooks', payload: validPayload });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('GET /webhooks', () => {
    it('should return 200 with paginated webhooks', async () => {
      const service = createFakeService();
      service.responses.listWebhooks = {
        webhooks: [
          {
            id: 'wh-1',
            url: 'https://x.com',
            events: ['order.created'],
            isActive: true,
            lastTriggeredAt: null,
            createdAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/webhooks',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).webhooks).toHaveLength(1);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/webhooks' });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('GET /webhooks/:webhookId', () => {
    it('should return 200 with webhook detail', async () => {
      const service = createFakeService();
      service.responses.getWebhook = {
        id: webhookId,
        url: 'https://x.com',
        events: ['order.created'],
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/webhooks/not-a-uuid',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 404 when not found', async () => {
      const service = createFakeService();
      service.responses.getWebhook = () => {
        throw new NotFoundError('Webhook not found', 'WEBHOOK_NOT_FOUND');
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });

  describe('PUT /webhooks/:webhookId', () => {
    it('should return 200 on valid update', async () => {
      const service = createFakeService();
      service.responses.updateWebhook = {
        id: webhookId,
        url: 'https://new.com',
        events: ['order.created'],
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PUT',
        url: `/webhooks/${webhookId}`,
        headers: { authorization: 'Bearer valid' },
        payload: { url: 'https://new.com' },
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PUT',
        url: '/webhooks/bad',
        headers: { authorization: 'Bearer valid' },
        payload: { url: 'https://x.com' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('DELETE /webhooks/:webhookId', () => {
    it('should return 204 on successful delete', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: `/webhooks/${webhookId}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(204);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: '/webhooks/bad',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'DELETE', url: `/webhooks/${webhookId}` });
      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });
});
