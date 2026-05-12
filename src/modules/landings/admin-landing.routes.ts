import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateParams, validateQuery } from '../../shared/middleware/validation';
import type { LandingService } from './landing.service';
import {
  adminLandingsQuerySchema,
  landingCreateSchema,
  landingIdParamSchema,
  landingUpdateSchema,
} from './landing.types';

export interface AdminLandingRoutesDeps {
  service: LandingService;
  authenticate: preHandlerAsyncHookHandler;
  requireAdmin: (req: FastifyRequest) => void | Promise<void>;
}

export function createAdminLandingRoutes(deps: AdminLandingRoutesDeps): FastifyPluginAsync {
  const { service, authenticate, requireAdmin } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);

    app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const query = validateQuery(adminLandingsQuerySchema, request.query);
      const result = await service.adminList(query);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/:landingId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const result = await service.adminGet(params.landingId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const body = validateBody(landingCreateSchema, request.body);
      const result = await service.adminCreate(body);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.patch('/:landingId', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const body = validateBody(landingUpdateSchema, request.body);
      const result = await service.adminUpdate(params.landingId, body);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/:landingId/publish', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const result = await service.adminPublish(params.landingId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/:landingId/unpublish', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const result = await service.adminUnpublish(params.landingId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.post('/:landingId/archive', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const result = await service.adminArchive(params.landingId);
      return reply.status(StatusCodes.OK).send(result);
    });

    app.get('/:landingId/analytics', async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(request);
      const params = validateParams(landingIdParamSchema, request.params);
      const result = await service.adminAnalytics(params.landingId);
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
