import Fastify, { type FastifyInstance } from 'fastify';
import { AppError } from '../../../shared/errors/app-error';

const mockCreateTrackingLink = jest.fn();
const mockListTrackingLinks = jest.fn();
const mockDeleteTrackingLink = jest.fn();

jest.mock('../tracking.service', () => ({
  createTrackingLink: (...args: unknown[]): unknown => mockCreateTrackingLink(...args),
  listTrackingLinks: (...args: unknown[]): unknown => mockListTrackingLinks(...args),
  deleteTrackingLink: (...args: unknown[]): unknown => mockDeleteTrackingLink(...args),
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

const adminUser = { userId: 'admin-id', email: 'admin@test.com', role: 'ADMIN', jti: 'jti-1' };

function withAdmin(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue(adminUser);
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer valid-token' };
}

function withRegularUser(): Record<string, string> {
  mockVerifyAccessToken.mockReturnValue({ ...adminUser, role: 'USER' });
  mockIsBlacklisted.mockResolvedValue(false);
  return { authorization: 'Bearer user-token' };
}

const mockLinkResponse = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: '2024-01-01T00:00:00.000Z',
  registrations: 0,
  lastRegistration: null,
};

// We import the routes inside beforeAll to ensure mocks are applied
let adminTrackingRoutes: typeof import('../tracking.routes').adminTrackingRoutes;

describe('Tracking Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ adminTrackingRoutes } = await import('../tracking.routes'));

    app = Fastify({ logger: false });

    app.setErrorHandler((error: Error, _request, reply) => {
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send(error.toJSON());
      }
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
    });

    await app.register(adminTrackingRoutes, { prefix: '/admin/tracking-links' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/tracking-links', () => {
    it('should return 201 with created link', async () => {
      mockCreateTrackingLink.mockResolvedValue(mockLinkResponse);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: withAdmin(),
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.id).toBe('link-1');
      expect(body.code).toBe('promo2024');
      expect(body.registrations).toBe(0);
      expect(mockCreateTrackingLink).toHaveBeenCalledWith({
        code: 'promo2024',
        name: 'Promo Campaign',
      });
    });

    it('should return 422 when code is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: withAdmin(),
        payload: { name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(422);
      expect(mockCreateTrackingLink).not.toHaveBeenCalled();
    });

    it('should return 422 when code is too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: withAdmin(),
        payload: { code: 'ab', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(422);
      expect(mockCreateTrackingLink).not.toHaveBeenCalled();
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: withRegularUser(),
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /admin/tracking-links', () => {
    it('should return 200 with array of links', async () => {
      mockListTrackingLinks.mockResolvedValue([mockLinkResponse]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tracking-links',
        headers: withAdmin(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].code).toBe('promo2024');
    });

    it('should return 200 with empty array when no links', async () => {
      mockListTrackingLinks.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tracking-links',
        headers: withAdmin(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
    });
  });

  describe('DELETE /admin/tracking-links/:linkId', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should return 204 on successful deletion', async () => {
      mockDeleteTrackingLink.mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/tracking-links/${validUuid}`,
        headers: withAdmin(),
      });

      expect(res.statusCode).toBe(204);
      expect(mockDeleteTrackingLink).toHaveBeenCalledWith(validUuid);
    });

    it('should return 422 on invalid UUID', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/admin/tracking-links/not-a-uuid',
        headers: withAdmin(),
      });

      expect(res.statusCode).toBe(422);
      expect(mockDeleteTrackingLink).not.toHaveBeenCalled();
    });
  });
});
