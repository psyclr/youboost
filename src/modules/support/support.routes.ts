import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateQuery, validateParams } from '../../shared/middleware/validation';
import type { SupportService } from './support.service';
import {
  createTicketSchema,
  ticketMessageSchema,
  ticketQuerySchema,
  ticketIdSchema,
  updateTicketStatusSchema,
} from './support.types';

export interface SupportRoutesDeps {
  service: SupportService;
  authenticate: preHandlerAsyncHookHandler;
}

export interface AdminSupportRoutesDeps extends SupportRoutesDeps {
  requireAdmin: (req: FastifyRequest) => void | Promise<void>;
}

export function createSupportRoutes(deps: SupportRoutesDeps): FastifyPluginAsync {
  const { service, authenticate } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    // Create ticket
    app.post('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
      }
      const body = validateBody(createTicketSchema, request.body);
      const result = await service.createTicket(request.user.userId, body);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    // List user's tickets
    app.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
      }
      const query = validateQuery(ticketQuerySchema, request.query);
      const result = await service.listTickets(request.user.userId, query);
      return reply.status(StatusCodes.OK).send(result);
    });

    // Get ticket with messages
    app.get('/tickets/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
      }
      const params = validateParams(ticketIdSchema, request.params);
      const result = await service.getTicket(params.ticketId, request.user.userId);
      return reply.status(StatusCodes.OK).send(result);
    });

    // Add message to ticket
    app.post(
      '/tickets/:ticketId/messages',
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
          return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
        }
        const params = validateParams(ticketIdSchema, request.params);
        const body = validateBody(ticketMessageSchema, request.body);
        const result = await service.addMessage(params.ticketId, request.user.userId, body.body);
        return reply.status(StatusCodes.CREATED).send(result);
      },
    );
  };
}

export function createAdminSupportRoutes(deps: AdminSupportRoutesDeps): FastifyPluginAsync {
  const { service, authenticate, requireAdmin } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', async (req) => requireAdmin(req));

    // List all tickets
    app.get('/tickets', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = validateQuery(ticketQuerySchema, request.query);
      const result = await service.adminListTickets(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    // Get any ticket
    app.get('/tickets/:ticketId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(ticketIdSchema, request.params);
      const result = await service.adminGetTicket(params.ticketId);
      return reply.status(StatusCodes.OK).send(result);
    });

    // Admin reply
    app.post(
      '/tickets/:ticketId/messages',
      async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
          return reply.status(StatusCodes.UNAUTHORIZED).send({ error: 'Unauthorized' });
        }
        const params = validateParams(ticketIdSchema, request.params);
        const body = validateBody(ticketMessageSchema, request.body);
        const result = await service.adminAddMessage(
          params.ticketId,
          request.user.userId,
          body.body,
        );
        return reply.status(StatusCodes.CREATED).send(result);
      },
    );

    // Update ticket status
    app.patch('/tickets/:ticketId/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(ticketIdSchema, request.params);
      const body = validateBody(updateTicketStatusSchema, request.body);
      const result = await service.adminUpdateStatus(params.ticketId, body.status);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
