import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, ForbiddenError, UnauthorizedError } from '../../../shared/errors';
import { createProviderRoutes } from '../providers.routes';
import type { ProvidersService } from '../providers.service';
import type { AuthenticatedUser } from '../../auth';

type CreateCall = { input: unknown };
type ListCall = { query: unknown };
type GetCall = { id: string };
type UpdateCall = { id: string; input: unknown };
type DeactivateCall = { id: string };
type FetchServicesCall = { id: string };
type CheckBalanceCall = { id: string };

function createFakeService(): ProvidersService & {
  calls: {
    createProvider: CreateCall[];
    getProvider: GetCall[];
    listProviders: ListCall[];
    updateProvider: UpdateCall[];
    deactivateProvider: DeactivateCall[];
    fetchProviderServices: FetchServicesCall[];
    checkProviderBalance: CheckBalanceCall[];
  };
  responses: {
    createProvider: unknown;
    getProvider: unknown;
    listProviders: unknown;
    updateProvider: unknown;
    fetchProviderServices: unknown;
    checkProviderBalance: unknown;
  };
} {
  const calls = {
    createProvider: [] as CreateCall[],
    getProvider: [] as GetCall[],
    listProviders: [] as ListCall[],
    updateProvider: [] as UpdateCall[],
    deactivateProvider: [] as DeactivateCall[],
    fetchProviderServices: [] as FetchServicesCall[],
    checkProviderBalance: [] as CheckBalanceCall[],
  };
  const baseResponse = {
    providerId: 'prov-1',
    name: 'Test Provider',
    apiEndpoint: 'https://api.test.com/v2',
    isActive: true,
    priority: 10,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const responses = {
    createProvider: baseResponse as unknown,
    getProvider: { ...baseResponse, balance: null, metadata: null } as unknown,
    listProviders: {
      providers: [baseResponse],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as unknown,
    updateProvider: baseResponse as unknown,
    fetchProviderServices: [] as unknown,
    checkProviderBalance: { balance: 0, currency: 'USD' } as unknown,
  };
  return {
    async createProvider(input) {
      calls.createProvider.push({ input });
      return responses.createProvider as never;
    },
    async getProvider(id) {
      calls.getProvider.push({ id });
      return responses.getProvider as never;
    },
    async listProviders(query) {
      calls.listProviders.push({ query });
      return responses.listProviders as never;
    },
    async updateProvider(id, input) {
      calls.updateProvider.push({ id, input });
      return responses.updateProvider as never;
    },
    async deactivateProvider(id) {
      calls.deactivateProvider.push({ id });
    },
    async fetchProviderServices(id) {
      calls.fetchProviderServices.push({ id });
      return responses.fetchProviderServices as never;
    },
    async checkProviderBalance(id) {
      calls.checkProviderBalance.push({ id });
      return responses.checkProviderBalance as never;
    },
    calls,
    responses,
  };
}

const adminUser: AuthenticatedUser = {
  userId: 'u1',
  email: 'admin@test.com',
  role: 'ADMIN',
  jti: 'jti-1',
};
const regularUser: AuthenticatedUser = {
  userId: 'u2',
  email: 'user@test.com',
  role: 'USER',
  jti: 'jti-2',
};

interface AuthState {
  user: AuthenticatedUser | null;
}

function buildApp(state: AuthState, service: ProvidersService): FastifyInstance {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  });
  const authenticate = async (req: FastifyRequest): Promise<void> => {
    if (!state.user) {
      throw new UnauthorizedError('Missing token', 'MISSING_TOKEN');
    }
    req.user = state.user;
  };
  const requireAdmin = (req: FastifyRequest): void => {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required', 'ADMIN_REQUIRED');
    }
  };
  return app.register(createProviderRoutes({ service, authenticate, requireAdmin }), {
    prefix: '/providers',
  }) as unknown as FastifyInstance;
}

describe('Provider Routes', () => {
  describe('POST /providers', () => {
    const validPayload = {
      name: 'Test Provider',
      apiEndpoint: 'https://api.test.com/v2',
      apiKey: 'secret-key-123',
      priority: 10,
    };

    it('should return 201 for admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers: { authorization: 'Bearer admin' },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).providerId).toBe('prov-1');
      await app.close();
    });

    it('should return 403 for non-admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: regularUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers: { authorization: 'Bearer user' },
        payload: validPayload,
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('should return 401 without token', async () => {
      const service = createFakeService();
      const app = buildApp({ user: null }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: validPayload,
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('should return 422 on invalid payload', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers: { authorization: 'Bearer admin' },
        payload: { name: '' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('should return 422 on invalid URL', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers: { authorization: 'Bearer admin' },
        payload: { ...validPayload, apiEndpoint: 'not-a-url' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('GET /providers', () => {
    it('should return 200 for admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/providers',
        headers: { authorization: 'Bearer admin' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.providers).toHaveLength(1);
      await app.close();
    });

    it('should return 403 for non-admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: regularUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/providers',
        headers: { authorization: 'Bearer user' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('should pass query params', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      await app.inject({
        method: 'GET',
        url: '/providers?page=2&limit=10&isActive=true',
        headers: { authorization: 'Bearer admin' },
      });

      expect(service.calls.listProviders).toHaveLength(1);
      expect(service.calls.listProviders[0]?.query).toMatchObject({
        page: 2,
        limit: 10,
        isActive: true,
      });
      await app.close();
    });
  });

  describe('GET /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 for admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer admin' },
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it('should return 403 for non-admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: regularUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer user' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/providers/not-a-uuid',
        headers: { authorization: 'Bearer admin' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('PUT /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 for admin', async () => {
      const service = createFakeService();
      service.responses.updateProvider = {
        providerId: 'prov-1',
        name: 'Updated',
        apiEndpoint: 'https://api.test.com/v2',
        isActive: true,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer admin' },
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('Updated');
      await app.close();
    });

    it('should return 403 for non-admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: regularUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer user' },
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('should return 422 on invalid apiEndpoint in update', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer admin' },
        payload: { apiEndpoint: 'bad-url' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('DELETE /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 204 for admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer admin' },
      });

      expect(res.statusCode).toBe(204);
      await app.close();
    });

    it('should return 403 for non-admin', async () => {
      const service = createFakeService();
      const app = buildApp({ user: regularUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: `/providers/${providerId}`,
        headers: { authorization: 'Bearer user' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('should return 422 on invalid UUID', async () => {
      const service = createFakeService();
      const app = buildApp({ user: adminUser }, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: '/providers/bad-id',
        headers: { authorization: 'Bearer admin' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });
});
