import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError } from '../../../shared/errors';
import { createApiKeyRoutes } from '../api-keys.routes';
import type { ApiKeysService } from '../api-keys.service';
import type { AuthenticatedUser } from '../../auth';

function createFakeService(): ApiKeysService & {
  calls: {
    createApiKey: unknown[];
    listApiKeys: unknown[];
    revokeApiKey: unknown[];
  };
  responses: {
    createApiKey: unknown;
    listApiKeys: unknown;
    revokeApiKey: unknown | (() => unknown);
  };
} {
  const calls = {
    createApiKey: [] as unknown[],
    listApiKeys: [] as unknown[],
    revokeApiKey: [] as unknown[],
  };
  const responses: {
    createApiKey: unknown;
    listApiKeys: unknown;
    revokeApiKey: unknown | (() => unknown);
  } = {
    createApiKey: {
      apiKey: {
        id: 'k1',
        name: 'T',
        rateLimitTier: 'BASIC',
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        expiresAt: null,
      },
      rawKey: 'yb_default',
    },
    listApiKeys: {
      apiKeys: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    revokeApiKey: undefined,
  };
  return {
    async createApiKey(userId, input) {
      calls.createApiKey.push({ userId, input });
      return responses.createApiKey as never;
    },
    async listApiKeys(userId, query) {
      calls.listApiKeys.push({ userId, query });
      return responses.listApiKeys as never;
    },
    async revokeApiKey(userId, keyId) {
      calls.revokeApiKey.push({ userId, keyId });
      const r = responses.revokeApiKey;
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

function buildApp(state: AuthState, service: ApiKeysService): FastifyInstance {
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
  return app.register(createApiKeyRoutes({ service, authenticate }), {
    prefix: '/api-keys',
  }) as unknown as FastifyInstance;
}

const keyId = '550e8400-e29b-41d4-a716-446655440000';

describe('API Key Routes', () => {
  describe('POST /api-keys', () => {
    it('should return 201 on valid input', async () => {
      const service = createFakeService();
      service.responses.createApiKey = {
        apiKey: {
          id: 'k1',
          name: 'Test',
          rateLimitTier: 'BASIC',
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
          expiresAt: null,
        },
        rawKey: 'yb_abc123',
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'Test' },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).rawKey).toBe('yb_abc123');
      await app.close();
    });

    it('should return 422 on empty name', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: '' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 422 on invalid tier', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'Key', rateLimitTier: 'INVALID' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'POST', url: '/api-keys', payload: { name: 'K' } });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('should pass userId from auth to service', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'T' },
      });

      expect(service.calls.createApiKey).toHaveLength(1);
      expect(service.calls.createApiKey[0]).toMatchObject({
        userId: 'u1',
        input: expect.objectContaining({ name: 'T' }),
      });
      await app.close();
    });
  });

  describe('GET /api-keys', () => {
    it('should return 200 with paginated keys', async () => {
      const service = createFakeService();
      service.responses.listApiKeys = {
        apiKeys: [
          {
            id: 'k1',
            name: 'T',
            rateLimitTier: 'BASIC',
            isActive: true,
            lastUsedAt: null,
            createdAt: new Date(),
            expiresAt: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api-keys',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).apiKeys).toHaveLength(1);
      await app.close();
    });

    it('should pass query params to service', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      await app.inject({
        method: 'GET',
        url: '/api-keys?page=2&limit=10',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(service.calls.listApiKeys).toHaveLength(1);
      expect(service.calls.listApiKeys[0]).toMatchObject({
        userId: 'u1',
        query: expect.objectContaining({ page: 2, limit: 10 }),
      });
      await app.close();
    });

    it('should return 422 on invalid query', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/api-keys?page=0',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/api-keys' });

      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('DELETE /api-keys/:keyId', () => {
    it('should return 204 on successful revoke', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api-keys/${keyId}`,
        headers: { authorization: 'Bearer valid-token' },
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
        url: '/api-keys/not-a-uuid',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: null }, service);
      await app.ready();

      const res = await app.inject({ method: 'DELETE', url: `/api-keys/${keyId}` });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('should pass userId and keyId to service', async () => {
      const service = createFakeService();
      const app = buildApp({ userHeader: 'bearer x' }, service);
      await app.ready();

      await app.inject({
        method: 'DELETE',
        url: `/api-keys/${keyId}`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(service.calls.revokeApiKey).toEqual([{ userId: 'u1', keyId }]);
      await app.close();
    });
  });
});
