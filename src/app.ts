import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { StatusCodes } from 'http-status-codes';
import { openapiSpec } from './shared/swagger/openapi-spec';
import { AppError } from './shared/errors/app-error';
import { checkHealth } from './shared/health/health';
import { createServiceLogger } from './shared/utils/logger';
import { getConfig } from './shared/config';
import { getPrisma } from './shared/database/prisma';
import { getRedis } from './shared/redis/redis';
import { createRedisCache } from './shared/cache/redis-cache';
import { authRoutes } from './modules/auth/auth.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { stripeRoutes } from './modules/billing/stripe/stripe.routes';
import { cryptomusRoutes } from './modules/billing/cryptomus/cryptomus.routes';
import { orderRoutes } from './modules/orders/orders.routes';
import { providerRoutes } from './modules/providers/providers.routes';
import { apiKeyRoutes } from './modules/api-keys/api-keys.routes';
import { webhookRoutes } from './modules/webhooks/webhooks.routes';
import { createCatalogRepository } from './modules/catalog/catalog.repository';
import { createCatalogService } from './modules/catalog/catalog.service';
import { createCatalogRoutes } from './modules/catalog/catalog.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { createSupportRepository } from './modules/support/support.repository';
import { createSupportService } from './modules/support/support.service';
import { createSupportRoutes, createAdminSupportRoutes } from './modules/support/support.routes';
import { referralRoutes } from './modules/referrals/referrals.routes';
import { createCouponsRepository } from './modules/coupons/coupons.repository';
import { createCouponsService } from './modules/coupons/coupons.service';
import { createCouponRoutes, createAdminCouponRoutes } from './modules/coupons/coupons.routes';
import { createTrackingRepository } from './modules/tracking/tracking.repository';
import { createTrackingService } from './modules/tracking/tracking.service';
import { createAdminTrackingRoutes } from './modules/tracking/tracking.routes';
import { authenticate } from './modules/auth/auth.middleware';
import { requireAdmin } from './modules/providers/providers.middleware';

const log = createServiceLogger('http');

export async function createApp(): Promise<FastifyInstance> {
  const config = getConfig();
  const app = Fastify({
    logger: false,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  const corsOrigins = config.security.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  await app.register(cors, {
    origin: corsOrigins,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    max: config.security.rateLimitMax,
    timeWindow: config.security.rateLimitWindowMs,
  });

  await app.register(swagger, {
    mode: 'static',
    specification: { document: openapiSpec },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  app.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
    log.info({ method: request.method, url: request.url, reqId: request.id }, 'request received');
    done();
  });

  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    log.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode, reqId: request.id },
      'request completed',
    );
    done();
  });

  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    const fastifyError = error as Error & { validation?: unknown; statusCode?: number };
    if (fastifyError.validation) {
      return reply.status(StatusCodes.UNPROCESSABLE_ENTITY).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: fastifyError.validation,
        },
      });
    }

    log.error({ err: error }, 'Unhandled error');

    return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(StatusCodes.NOT_FOUND).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    }),
  );

  app.get('/health', async () => checkHealth());

  app.get('/', async () => ({
    name: 'youboost-api',
    version: '0.1.0-alpha',
    status: 'running',
  }));

  // Composition root — converted modules (factory-based DI) are wired here.
  // Unconverted modules continue to use singleton shims internally; they
  // will be migrated to this pattern in subsequent phases.
  const prisma = getPrisma();
  const redis = getRedis();
  const cache = createRedisCache(redis);

  const catalogRepo = createCatalogRepository(prisma);
  const catalogService = createCatalogService({
    catalogRepo,
    cache,
    logger: createServiceLogger('catalog'),
  });

  const trackingRepo = createTrackingRepository(prisma);
  const trackingService = createTrackingService({
    trackingRepo,
    logger: createServiceLogger('tracking'),
  });

  const supportRepo = createSupportRepository(prisma);
  const supportService = createSupportService({
    supportRepo,
    logger: createServiceLogger('support'),
  });

  const couponsRepo = createCouponsRepository(prisma);
  const couponsService = createCouponsService({
    couponsRepo,
    logger: createServiceLogger('coupons'),
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(stripeRoutes, { prefix: '/billing/stripe' });
  await app.register(cryptomusRoutes, { prefix: '/billing/cryptomus' });
  await app.register(orderRoutes, { prefix: '/orders' });
  await app.register(providerRoutes, { prefix: '/providers' });
  await app.register(apiKeyRoutes, { prefix: '/api-keys' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(createCatalogRoutes(catalogService), { prefix: '/catalog' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(notificationRoutes, { prefix: '/notifications' });
  await app.register(createSupportRoutes({ service: supportService, authenticate }), {
    prefix: '/support',
  });
  await app.register(
    createAdminSupportRoutes({ service: supportService, authenticate, requireAdmin }),
    { prefix: '/admin/support' },
  );
  await app.register(referralRoutes, { prefix: '/referrals' });
  await app.register(createCouponRoutes({ service: couponsService, authenticate }), {
    prefix: '/coupons',
  });
  await app.register(
    createAdminCouponRoutes({ service: couponsService, authenticate, requireAdmin }),
    { prefix: '/admin/coupons' },
  );
  await app.register(
    createAdminTrackingRoutes({ service: trackingService, authenticate, requireAdmin }),
    { prefix: '/admin/tracking-links' },
  );

  return app;
}
