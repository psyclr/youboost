import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError, ForbiddenError } from '../../../shared/errors';
import { createAdminTrackingRoutes } from '../tracking.routes';
import type { TrackingService } from '../tracking.service';
import type { AuthenticatedUser } from '../../auth';

function createFakeService(): TrackingService & {
  calls: {
    createTrackingLink: unknown[];
    listTrackingLinks: number;
    deleteTrackingLink: string[];
  };
  responses: {
    createTrackingLink: unknown;
    listTrackingLinks: unknown;
  };
} {
  const calls = {
    createTrackingLink: [] as unknown[],
    listTrackingLinks: 0,
    deleteTrackingLink: [] as string[],
  };
  const responses: { createTrackingLink: unknown; listTrackingLinks: unknown } = {
    createTrackingLink: {},
    listTrackingLinks: [],
  };
  return {
    async createTrackingLink(input) {
      calls.createTrackingLink.push(input);
      return responses.createTrackingLink as never;
    },
    async listTrackingLinks() {
      calls.listTrackingLinks += 1;
      return responses.listTrackingLinks as never;
    },
    async deleteTrackingLink(id) {
      calls.deleteTrackingLink.push(id);
    },
    calls,
    responses,
  };
}

const adminUser: AuthenticatedUser = {
  userId: 'admin-id',
  email: 'admin@test.com',
  role: 'ADMIN',
  jti: 'jti-1',
};

interface AuthState {
  userHeader: string | null;
  role: 'ADMIN' | 'USER';
}

function buildApp(state: AuthState, service: TrackingService): FastifyInstance {
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
    req.user = { ...adminUser, role: state.role };
  };
  const requireAdmin = (req: FastifyRequest): void => {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenError('Admin required', 'ADMIN_REQUIRED');
    }
  };
  return app.register(createAdminTrackingRoutes({ service, authenticate, requireAdmin }), {
    prefix: '/admin/tracking-links',
  }) as unknown as FastifyInstance;
}

const mockLinkResponse = {
  id: 'link-1',
  code: 'promo2024',
  name: 'Promo Campaign',
  createdAt: '2024-01-01T00:00:00.000Z',
  registrations: 0,
  lastRegistration: null,
};

describe('Tracking Routes', () => {
  describe('POST /admin/tracking-links', () => {
    it('returns 201 with created link', async () => {
      const service = createFakeService();
      service.responses.createTrackingLink = mockLinkResponse;
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('promo2024');
      expect(service.calls.createTrackingLink).toEqual([
        { code: 'promo2024', name: 'Promo Campaign' },
      ]);
      await app.close();
    });

    it('returns 422 when code is missing', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
        payload: { name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.createTrackingLink).toHaveLength(0);
      await app.close();
    });

    it('returns 422 when code too short', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
        payload: { code: 'ab', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('returns 401 without token', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: null, role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 403 for non-admin user', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: 'bearer x', role: 'USER' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
        payload: { code: 'promo2024', name: 'Promo Campaign' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });

  describe('GET /admin/tracking-links', () => {
    it('returns 200 with array of links', async () => {
      const service = createFakeService();
      service.responses.listTrackingLinks = [mockLinkResponse];
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      await app.close();
    });

    it('returns 200 with empty array when no links', async () => {
      const service = createFakeService();
      service.responses.listTrackingLinks = [];
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tracking-links',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
      await app.close();
    });
  });

  describe('DELETE /admin/tracking-links/:linkId', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 204 on successful deletion', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: `/admin/tracking-links/${validUuid}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(204);
      expect(service.calls.deleteTrackingLink).toEqual([validUuid]);
      await app.close();
    });

    it('returns 422 on invalid UUID', async () => {
      const service = createFakeService();
      const state: AuthState = { userHeader: 'bearer x', role: 'ADMIN' };
      const app = buildApp(state, service);
      await app.ready();

      const res = await app.inject({
        method: 'DELETE',
        url: '/admin/tracking-links/not-a-uuid',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.deleteTrackingLink).toHaveLength(0);
      await app.close();
    });
  });
});
