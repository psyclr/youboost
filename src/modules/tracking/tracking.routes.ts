import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateParams } from '../../shared/middleware/validation';
import type { TrackingService } from './tracking.service';
import { createTrackingLinkSchema, trackingLinkIdSchema } from './tracking.types';

export interface TrackingRoutesDeps {
  service: TrackingService;
  authenticate: preHandlerAsyncHookHandler;
  requireAdmin: (request: FastifyRequest) => void | Promise<void>;
}

export function createAdminTrackingRoutes(deps: TrackingRoutesDeps): FastifyPluginAsync {
  const { service, authenticate, requireAdmin } = deps;
  return async (app) => {
    app.addHook('preHandler', authenticate);
    app.addHook('preHandler', async (req) => requireAdmin(req));

    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = validateBody(createTrackingLinkSchema, request.body);
      const result = await service.createTrackingLink(body);
      return reply.status(StatusCodes.CREATED).send(result);
    });

    app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await service.listTrackingLinks();
      return reply.status(StatusCodes.OK).send(result);
    });

    app.delete('/:linkId', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(trackingLinkIdSchema, request.params);
      await service.deleteTrackingLink(params.linkId);
      return reply.status(StatusCodes.NO_CONTENT).send();
    });
  };
}
