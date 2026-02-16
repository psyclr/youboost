import Fastify, { type FastifyInstance } from 'fastify';
import { apiKeyRoutes } from '../api-keys.routes';
import { AppError } from '../../../shared/errors/app-error';

const mockGenerateApiKey = jest.fn();
const mockListApiKeys = jest.fn();
const mockRevokeApiKey = jest.fn();

jest.mock('../api-keys.service', () => ({
  generateApiKey: (...args: unknown[]): unknown => mockGenerateApiKey(...args),
  listApiKeys: (...args: unknown[]): unknown => mockListApiKeys(...args),
  revokeApiKey: (...args: unknown[]): unknown => mockRevokeApiKey(...args),
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

describe('API Key Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });
    await app.register(apiKeyRoutes, { prefix: '/api-keys' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api-keys', () => {
    it('should return 201 on valid input', async () => {
      const headers = withAuth();
      mockGenerateApiKey.mockResolvedValue({
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
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers,
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).rawKey).toBe('yb_abc123');
    });

    it('should return 422 on empty name', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers,
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 422 on invalid tier', async () => {
      const headers = withAuth();
      const res = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers,
        payload: { name: 'Key', rateLimitTier: 'INVALID' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'POST', url: '/api-keys', payload: { name: 'K' } });
      expect(res.statusCode).toBe(401);
    });

    it('should pass userId from auth to service', async () => {
      const headers = withAuth();
      mockGenerateApiKey.mockResolvedValue({
        apiKey: {
          id: 'k1',
          name: 'T',
          rateLimitTier: 'BASIC',
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
          expiresAt: null,
        },
        rawKey: 'yb_x',
      });
      await app.inject({ method: 'POST', url: '/api-keys', headers, payload: { name: 'T' } });
      expect(mockGenerateApiKey).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'T' }));
    });
  });

  describe('GET /api-keys', () => {
    it('should return 200 with paginated keys', async () => {
      const headers = withAuth();
      mockListApiKeys.mockResolvedValue({
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
      });
      const res = await app.inject({ method: 'GET', url: '/api-keys', headers });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).apiKeys).toHaveLength(1);
    });

    it('should pass query params to service', async () => {
      const headers = withAuth();
      mockListApiKeys.mockResolvedValue({
        apiKeys: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });
      await app.inject({ method: 'GET', url: '/api-keys?page=2&limit=10', headers });
      expect(mockListApiKeys).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });

    it('should return 422 on invalid query', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'GET', url: '/api-keys?page=0', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api-keys' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api-keys/:keyId', () => {
    const keyId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 204 on successful revoke', async () => {
      const headers = withAuth();
      mockRevokeApiKey.mockResolvedValue(undefined);
      const res = await app.inject({ method: 'DELETE', url: `/api-keys/${keyId}`, headers });
      expect(res.statusCode).toBe(204);
    });

    it('should return 422 on invalid UUID', async () => {
      const headers = withAuth();
      const res = await app.inject({ method: 'DELETE', url: '/api-keys/not-a-uuid', headers });
      expect(res.statusCode).toBe(422);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api-keys/${keyId}` });
      expect(res.statusCode).toBe(401);
    });

    it('should pass userId and keyId to service', async () => {
      const headers = withAuth();
      mockRevokeApiKey.mockResolvedValue(undefined);
      await app.inject({ method: 'DELETE', url: `/api-keys/${keyId}`, headers });
      expect(mockRevokeApiKey).toHaveBeenCalledWith('u1', keyId);
    });
  });
});
