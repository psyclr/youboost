import Fastify, { type FastifyInstance } from 'fastify';
import { providerRoutes } from '../providers.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockCreateProvider = jest.fn();
const mockGetProvider = jest.fn();
const mockListProviders = jest.fn();
const mockUpdateProvider = jest.fn();
const mockDeactivateProvider = jest.fn();

jest.mock('../providers.service', () => ({
  createProvider: (...args: unknown[]): unknown => mockCreateProvider(...args),
  getProvider: (...args: unknown[]): unknown => mockGetProvider(...args),
  listProviders: (...args: unknown[]): unknown => mockListProviders(...args),
  updateProvider: (...args: unknown[]): unknown => mockUpdateProvider(...args),
  deactivateProvider: (...args: unknown[]): unknown => mockDeactivateProvider(...args),
}));

const mockVerifyAccessToken = jest.fn();
const mockIsBlacklisted = jest.fn();

jest.mock('../../auth/utils/tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => mockVerifyAccessToken(...args),
}));

jest.mock('../../auth/token.repository', () => ({
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

const adminUser = { userId: 'u1', email: 'admin@test.com', role: 'ADMIN', jti: 'jti-1' };
const regularUser = { userId: 'u2', email: 'user@test.com', role: 'USER', jti: 'jti-2' };

function withAdmin(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(adminUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer admin-token' };
}

function withUser(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(regularUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer user-token' };
}

const providerResponse = {
  providerId: 'prov-1',
  name: 'Test Provider',
  apiEndpoint: 'https://api.test.com/v2',
  isActive: true,
  priority: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Provider Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(providerRoutes, { prefix: '/providers' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /providers', () => {
    const validPayload = {
      name: 'Test Provider',
      apiEndpoint: 'https://api.test.com/v2',
      apiKey: 'secret-key-123',
      priority: 10,
    };

    it('should return 201 for admin', async () => {
      const headers = withAdmin();
      mockCreateProvider.mockResolvedValue(providerResponse);

      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).providerId).toBe('prov-1');
    });

    it('should return 403 for non-admin', async () => {
      const headers = withUser();
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers,
        payload: validPayload,
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        payload: validPayload,
      });
      expect(res.statusCode).toBe(401);
    });

    it('should return 422 on invalid payload', async () => {
      const headers = withAdmin();
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers,
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on invalid URL', async () => {
      const headers = withAdmin();
      const res = await app.inject({
        method: 'POST',
        url: '/providers',
        headers,
        payload: { ...validPayload, apiEndpoint: 'not-a-url' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /providers', () => {
    it('should return 200 for admin', async () => {
      const headers = withAdmin();
      mockListProviders.mockResolvedValue({
        providers: [providerResponse],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await app.inject({ method: 'GET', url: '/providers', headers });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.providers).toHaveLength(1);
    });

    it('should return 403 for non-admin', async () => {
      const headers = withUser();
      const res = await app.inject({ method: 'GET', url: '/providers', headers });
      expect(res.statusCode).toBe(403);
    });

    it('should pass query params', async () => {
      const headers = withAdmin();
      mockListProviders.mockResolvedValue({
        providers: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await app.inject({ method: 'GET', url: '/providers?page=2&limit=10&isActive=true', headers });

      expect(mockListProviders).toHaveBeenCalledWith({ page: 2, limit: 10, isActive: true });
    });
  });

  describe('GET /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 for admin', async () => {
      const headers = withAdmin();
      mockGetProvider.mockResolvedValue({ ...providerResponse, balance: null, metadata: null });

      const res = await app.inject({ method: 'GET', url: `/providers/${providerId}`, headers });

      expect(res.statusCode).toBe(200);
    });

    it('should return 403 for non-admin', async () => {
      const headers = withUser();
      const res = await app.inject({ method: 'GET', url: `/providers/${providerId}`, headers });
      expect(res.statusCode).toBe(403);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAdmin();
      const res = await app.inject({ method: 'GET', url: '/providers/not-a-uuid', headers });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('PUT /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 200 for admin', async () => {
      const headers = withAdmin();
      mockUpdateProvider.mockResolvedValue({ ...providerResponse, name: 'Updated' });

      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers,
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).name).toBe('Updated');
    });

    it('should return 403 for non-admin', async () => {
      const headers = withUser();
      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers,
        payload: { name: 'Updated' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 422 on invalid apiEndpoint in update', async () => {
      const headers = withAdmin();
      const res = await app.inject({
        method: 'PUT',
        url: `/providers/${providerId}`,
        headers,
        payload: { apiEndpoint: 'bad-url' },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('DELETE /providers/:providerId', () => {
    const providerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 204 for admin', async () => {
      const headers = withAdmin();
      mockDeactivateProvider.mockResolvedValue(undefined);

      const res = await app.inject({ method: 'DELETE', url: `/providers/${providerId}`, headers });

      expect(res.statusCode).toBe(204);
    });

    it('should return 403 for non-admin', async () => {
      const headers = withUser();
      const res = await app.inject({ method: 'DELETE', url: `/providers/${providerId}`, headers });
      expect(res.statusCode).toBe(403);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAdmin();
      const res = await app.inject({ method: 'DELETE', url: '/providers/bad-id', headers });
      expect(res.statusCode).toBe(422);
    });
  });
});
