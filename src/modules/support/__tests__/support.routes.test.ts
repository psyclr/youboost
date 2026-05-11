import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError } from '../../../shared/errors';
import { createSupportRoutes, createAdminSupportRoutes } from '../support.routes';
import type { SupportService } from '../support.service';
import type { AuthenticatedUser } from '../../auth';

function createFakeService(): SupportService & {
  calls: {
    createTicket: Array<{ userId: string; input: unknown }>;
    getTicket: Array<{ ticketId: string; userId: string }>;
    listTickets: Array<{ userId: string; query: unknown }>;
    addMessage: Array<{ ticketId: string; userId: string; body: string }>;
    adminListTickets: unknown[];
    adminGetTicket: string[];
    adminAddMessage: Array<{ ticketId: string; adminUserId: string; body: string }>;
    adminUpdateStatus: Array<{ ticketId: string; status: string }>;
  };
  responses: {
    createTicket: unknown;
    getTicket: unknown;
    listTickets: unknown;
    addMessage: unknown;
    adminListTickets: unknown;
    adminGetTicket: unknown;
    adminAddMessage: unknown;
    adminUpdateStatus: unknown;
  };
  throws: {
    getTicket?: Error;
    adminGetTicket?: Error;
  };
} {
  const calls = {
    createTicket: [] as Array<{ userId: string; input: unknown }>,
    getTicket: [] as Array<{ ticketId: string; userId: string }>,
    listTickets: [] as Array<{ userId: string; query: unknown }>,
    addMessage: [] as Array<{ ticketId: string; userId: string; body: string }>,
    adminListTickets: [] as unknown[],
    adminGetTicket: [] as string[],
    adminAddMessage: [] as Array<{ ticketId: string; adminUserId: string; body: string }>,
    adminUpdateStatus: [] as Array<{ ticketId: string; status: string }>,
  };
  const responses = {
    createTicket: { id: 'ticket-1' },
    getTicket: { id: 'ticket-1', messages: [] },
    listTickets: { tickets: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    addMessage: { id: 'msg-1' },
    adminListTickets: {
      tickets: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
    adminGetTicket: { id: 'ticket-1', messages: [] },
    adminAddMessage: { id: 'msg-1' },
    adminUpdateStatus: { id: 'ticket-1', status: 'CLOSED' },
  };
  const throws: { getTicket?: Error; adminGetTicket?: Error } = {};

  return {
    async createTicket(userId, input) {
      calls.createTicket.push({ userId, input });
      return responses.createTicket as never;
    },
    async getTicket(ticketId, userId) {
      calls.getTicket.push({ ticketId, userId });
      if (throws.getTicket) throw throws.getTicket;
      return responses.getTicket as never;
    },
    async listTickets(userId, query) {
      calls.listTickets.push({ userId, query });
      return responses.listTickets as never;
    },
    async addMessage(ticketId, userId, body) {
      calls.addMessage.push({ ticketId, userId, body });
      return responses.addMessage as never;
    },
    async adminListTickets(query) {
      calls.adminListTickets.push(query);
      return responses.adminListTickets as never;
    },
    async adminGetTicket(ticketId) {
      calls.adminGetTicket.push(ticketId);
      if (throws.adminGetTicket) throw throws.adminGetTicket;
      return responses.adminGetTicket as never;
    },
    async adminAddMessage(ticketId, adminUserId, body) {
      calls.adminAddMessage.push({ ticketId, adminUserId, body });
      return responses.adminAddMessage as never;
    },
    async adminUpdateStatus(ticketId, status) {
      calls.adminUpdateStatus.push({ ticketId, status });
      return responses.adminUpdateStatus as never;
    },
    calls,
    responses,
    throws,
  };
}

const baseUser: AuthenticatedUser = {
  userId: 'user-1',
  email: 'u@test.com',
  role: 'USER',
  jti: 'jti-1',
};

interface AuthState {
  userHeader: string | null;
  role: 'ADMIN' | 'USER';
}

function buildUserApp(state: AuthState, service: SupportService): FastifyInstance {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error: Error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  });
  const authenticate = async (req: FastifyRequest): Promise<void> => {
    if (!state.userHeader) {
      throw new UnauthorizedError('Missing token', 'MISSING_TOKEN');
    }
    req.user = { ...baseUser, role: state.role };
  };
  return app.register(createSupportRoutes({ service, authenticate }), {
    prefix: '/support',
  }) as unknown as FastifyInstance;
}

function buildAdminApp(state: AuthState, service: SupportService): FastifyInstance {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error: Error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }
    return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: error.message } });
  });
  const authenticate = async (req: FastifyRequest): Promise<void> => {
    if (!state.userHeader) {
      throw new UnauthorizedError('Missing token', 'MISSING_TOKEN');
    }
    req.user = { ...baseUser, role: state.role };
  };
  const requireAdmin = (req: FastifyRequest): void => {
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenError('Admin required', 'ADMIN_REQUIRED');
    }
  };
  return app.register(createAdminSupportRoutes({ service, authenticate, requireAdmin }), {
    prefix: '/admin/support',
  }) as unknown as FastifyInstance;
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Support Routes (user)', () => {
  describe('POST /support/tickets', () => {
    it('returns 201 with created ticket', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/support/tickets',
        headers: { authorization: 'Bearer valid' },
        payload: {
          subject: 'Need help',
          description: 'I have a problem with my order',
          priority: 'HIGH',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(service.calls.createTicket).toEqual([
        {
          userId: 'user-1',
          input: {
            subject: 'Need help',
            description: 'I have a problem with my order',
            priority: 'HIGH',
          },
        },
      ]);
      await app.close();
    });

    it('returns 401 without token', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: null, role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/support/tickets',
        payload: { subject: 'Hi', description: 'Hello there please', priority: 'LOW' },
      });

      expect(res.statusCode).toBe(401);
      expect(service.calls.createTicket).toHaveLength(0);
      await app.close();
    });

    it('returns 422 when subject too short', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/support/tickets',
        headers: { authorization: 'Bearer valid' },
        payload: { subject: 'Hi', description: 'Hello there please help', priority: 'LOW' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.createTicket).toHaveLength(0);
      await app.close();
    });

    it('returns 422 when description too short', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: '/support/tickets',
        headers: { authorization: 'Bearer valid' },
        payload: { subject: 'Need help', description: 'short', priority: 'LOW' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('GET /support/tickets', () => {
    it('returns 200 with paginated tickets', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/support/tickets',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(service.calls.listTickets).toHaveLength(1);
      expect(service.calls.listTickets[0]?.userId).toBe('user-1');
      await app.close();
    });

    it('returns 401 without token', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: null, role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/support/tickets' });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 422 on invalid status filter', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/support/tickets?status=INVALID',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('GET /support/tickets/:ticketId', () => {
    it('returns 200 with ticket detail', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/support/tickets/${VALID_UUID}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(service.calls.getTicket).toEqual([{ ticketId: VALID_UUID, userId: 'user-1' }]);
      await app.close();
    });

    it('returns 404 when service throws NotFoundError', async () => {
      const service = createFakeService();
      service.throws.getTicket = new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/support/tickets/${VALID_UUID}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 422 on invalid ticketId', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/support/tickets/not-a-uuid',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('POST /support/tickets/:ticketId/messages', () => {
    it('returns 201 on successful message add', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/support/tickets/${VALID_UUID}/messages`,
        headers: { authorization: 'Bearer valid' },
        payload: { body: 'hi there' },
      });

      expect(res.statusCode).toBe(201);
      expect(service.calls.addMessage).toEqual([
        { ticketId: VALID_UUID, userId: 'user-1', body: 'hi there' },
      ]);
      await app.close();
    });

    it('returns 422 with empty body', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/support/tickets/${VALID_UUID}/messages`,
        headers: { authorization: 'Bearer valid' },
        payload: { body: '' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.addMessage).toHaveLength(0);
      await app.close();
    });

    it('returns 401 without token', async () => {
      const service = createFakeService();
      const app = buildUserApp({ userHeader: null, role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/support/tickets/${VALID_UUID}/messages`,
        payload: { body: 'hi' },
      });

      expect(res.statusCode).toBe(401);
      await app.close();
    });
  });
});

describe('Support Routes (admin)', () => {
  describe('GET /admin/support/tickets', () => {
    it('returns 200 for admin', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/support/tickets',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(service.calls.adminListTickets).toHaveLength(1);
      await app.close();
    });

    it('returns 401 without token', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: null, role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({ method: 'GET', url: '/admin/support/tickets' });

      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('returns 403 for non-admin user', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/support/tickets',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(403);
      expect(service.calls.adminListTickets).toHaveLength(0);
      await app.close();
    });

    it('returns 422 on invalid status filter', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/support/tickets?status=INVALID',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('GET /admin/support/tickets/:ticketId', () => {
    it('returns 200 for admin', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/admin/support/tickets/${VALID_UUID}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(200);
      expect(service.calls.adminGetTicket).toEqual([VALID_UUID]);
      await app.close();
    });

    it('returns 404 when service throws NotFoundError', async () => {
      const service = createFakeService();
      service.throws.adminGetTicket = new NotFoundError('Ticket not found', 'TICKET_NOT_FOUND');
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/admin/support/tickets/${VALID_UUID}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(404);
      await app.close();
    });

    it('returns 403 for non-admin user', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: `/admin/support/tickets/${VALID_UUID}`,
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });

    it('returns 422 on invalid ticketId', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/admin/support/tickets/not-a-uuid',
        headers: { authorization: 'Bearer valid' },
      });

      expect(res.statusCode).toBe(422);
      await app.close();
    });
  });

  describe('POST /admin/support/tickets/:ticketId/messages', () => {
    it('returns 201 on admin reply', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/admin/support/tickets/${VALID_UUID}/messages`,
        headers: { authorization: 'Bearer valid' },
        payload: { body: 'admin reply' },
      });

      expect(res.statusCode).toBe(201);
      expect(service.calls.adminAddMessage).toEqual([
        { ticketId: VALID_UUID, adminUserId: 'user-1', body: 'admin reply' },
      ]);
      await app.close();
    });

    it('returns 422 with empty body', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/admin/support/tickets/${VALID_UUID}/messages`,
        headers: { authorization: 'Bearer valid' },
        payload: { body: '' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.adminAddMessage).toHaveLength(0);
      await app.close();
    });

    it('returns 403 for non-admin user', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'POST',
        url: `/admin/support/tickets/${VALID_UUID}/messages`,
        headers: { authorization: 'Bearer valid' },
        payload: { body: 'hi' },
      });

      expect(res.statusCode).toBe(403);
      expect(service.calls.adminAddMessage).toHaveLength(0);
      await app.close();
    });
  });

  describe('PATCH /admin/support/tickets/:ticketId/status', () => {
    it('returns 200 on status update', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/support/tickets/${VALID_UUID}/status`,
        headers: { authorization: 'Bearer valid' },
        payload: { status: 'CLOSED' },
      });

      expect(res.statusCode).toBe(200);
      expect(service.calls.adminUpdateStatus).toEqual([{ ticketId: VALID_UUID, status: 'CLOSED' }]);
      await app.close();
    });

    it('returns 422 on invalid status', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'ADMIN' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/support/tickets/${VALID_UUID}/status`,
        headers: { authorization: 'Bearer valid' },
        payload: { status: 'BOGUS' },
      });

      expect(res.statusCode).toBe(422);
      expect(service.calls.adminUpdateStatus).toHaveLength(0);
      await app.close();
    });

    it('returns 403 for non-admin user', async () => {
      const service = createFakeService();
      const app = buildAdminApp({ userHeader: 'bearer x', role: 'USER' }, service);
      await app.ready();

      const res = await app.inject({
        method: 'PATCH',
        url: `/admin/support/tickets/${VALID_UUID}/status`,
        headers: { authorization: 'Bearer valid' },
        payload: { status: 'CLOSED' },
      });

      expect(res.statusCode).toBe(403);
      await app.close();
    });
  });
});
