import Fastify, { type FastifyInstance } from 'fastify';
import { webhookRoutes } from '../webhooks.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockCreateWebhook = jest.fn();
const mockListWebhooks = jest.fn();
const mockGetWebhook = jest.fn();
const mockUpdateWebhook = jest.fn();
const mockDeleteWebhook = jest.fn();

jest.mock('../webhooks.service', () => ({
  createWebhook: (...args: unknown[]): unknown => mockCreateWebhook(...args),
  listWebhooks: (...args: unknown[]): unknown => mockListWebhooks(...args),
  getWebhook: (...args: unknown[]): unknown => mockGetWebhook(...args),
  updateWebhook: (...args: unknown[]): unknown => mockUpdateWebhook(...args),
  deleteWebhook: (...args: unknown[]): unknown => mockDeleteWebhook(...args),
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
const webhookId = '550e8400-e29b-41d4-a716-446655440000';

function withAuth(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(validUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer valid-token' };
}

describe('Webhook Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) return reply.status(error.statusCode).send(error.toJSON());
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });
    await app.register(webhookRoutes, { prefix: '/webhooks' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  describe('POST /webhooks', () => {
    const validPayload = { url: 'https://example.com/hook', events: ['order.created'] };

    it('should return 201 on valid input', async () => {
      const headers = withAuth();
      mockCreateWebhook.mockResolvedValue({
        id: 'wh-1',
        url: validPayload.url,
        events: validPayload.events,
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      });
      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers,
        payload: validPayload,
      });
      expect(res.statusCode).toBe(201);
    });

    it('should return 422 on invalid URL', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers,
        payload: { url: 'bad', events: ['order.created'] },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on empty events', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers,
        payload: { url: 'https://x.com', events: [] },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'POST', url: '/webhooks', payload: validPayload });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /webhooks', () => {
    it('should return 200 with paginated webhooks', async () => {
      const headers = withAuth();
      mockListWebhooks.mockResolvedValue({
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
      });
      const res = await app.inject({ method: 'GET', url: '/webhooks', headers });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).webhooks).toHaveLength(1);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/webhooks' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /webhooks/:webhookId', () => {
    it('should return 200 with webhook detail', async () => {
      const headers = withAuth();
      mockGetWebhook.mockResolvedValue({
        id: webhookId,
        url: 'https://x.com',
        events: ['order.created'],
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      });
      const res = await app.inject({ method: 'GET', url: `/webhooks/${webhookId}`, headers });
      expect(res.statusCode).toBe(200);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'GET', url: '/webhooks/not-a-uuid', headers });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PUT /webhooks/:webhookId', () => {
    it('should return 200 on valid update', async () => {
      const headers = withAuth();
      mockUpdateWebhook.mockResolvedValue({
        id: webhookId,
        url: 'https://new.com',
        events: ['order.created'],
        isActive: true,
        lastTriggeredAt: null,
        createdAt: new Date(),
      });
      const res = await app.inject({
        method: 'PUT',
        url: `/webhooks/${webhookId}`,
        headers,
        payload: { url: 'https://new.com' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'PUT',
        url: '/webhooks/bad',
        headers,
        payload: { url: 'https://x.com' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('DELETE /webhooks/:webhookId', () => {
    it('should return 204 on successful delete', async () => {
      const headers = withAuth();
      mockDeleteWebhook.mockResolvedValue(undefined);
      const res = await app.inject({ method: 'DELETE', url: `/webhooks/${webhookId}`, headers });
      expect(res.statusCode).toBe(204);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'DELETE', url: '/webhooks/bad', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/webhooks/${webhookId}` });
      expect(res.statusCode).toBe(401);
    });
  });
});
