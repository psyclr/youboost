import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateParams } from '../../shared/middleware/validation';
import type { LandingService } from './landing.service';
import { landingSlugParamSchema } from './landing.types';

export interface LandingRoutesDeps {
  service: LandingService;
}

export function createLandingRoutes(deps: LandingRoutesDeps): FastifyPluginAsync {
  const { service } = deps;
  return async (app) => {
    app.get('/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = validateParams(landingSlugParamSchema, request.params);
      const userAgent = request.headers['user-agent'];
      const referrer = request.headers.referer ?? request.headers.referrer;
      const result = await service.getPublishedBySlug(params.slug, {
        userId: (request as { user?: { userId?: string } }).user?.userId ?? null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        referrer: typeof referrer === 'string' ? referrer : null,
      });
      return reply.status(StatusCodes.OK).send(result);
    });
  };
}
