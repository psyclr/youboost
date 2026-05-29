import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { validateBody, validateParams } from '../../shared/middleware/validation';
import type { LandingService } from './landing.service';
import {
  landingCalculateSchema,
  landingCartCheckoutSchema,
  landingCheckoutSchema,
  landingSlugParamSchema,
} from './landing.types';

export interface LandingRoutesDeps {
  service: LandingService;
}

export function createLandingRoutes(deps: LandingRoutesDeps): FastifyPluginAsync {
  const { service } = deps;
  return async (app) => {
    app.get('/default', async (request: FastifyRequest, reply: FastifyReply) => {
      const userAgent = request.headers['user-agent'];
      const referrer = request.headers.referer ?? request.headers.referrer;
      const result = await service.getDefaultPublished({
        userId: (request as { user?: { userId?: string } }).user?.userId ?? null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        referrer: typeof referrer === 'string' ? referrer : null,
      });
      return reply.status(StatusCodes.OK).send(result);
    });

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

    app.post(
      '/:slug/calculate',
      {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const params = validateParams(landingSlugParamSchema, request.params);
        const body = validateBody(landingCalculateSchema, request.body);
        const result = await service.calculate(params.slug, body);
        return reply.status(StatusCodes.OK).send(result);
      },
    );

    app.post(
      '/:slug/checkout',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const params = validateParams(landingSlugParamSchema, request.params);
        const body = validateBody(landingCheckoutSchema, request.body);
        const result = await service.checkout(params.slug, body);
        return reply.status(StatusCodes.CREATED).send(result);
      },
    );

    app.post(
      '/:slug/checkout/cart',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const params = validateParams(landingSlugParamSchema, request.params);
        const body = validateBody(landingCartCheckoutSchema, request.body);
        const result = await service.checkoutCart(params.slug, body);
        return reply.status(StatusCodes.CREATED).send(result);
      },
    );
  };
}
