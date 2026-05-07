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
import { authRoutes } from './modules/auth/auth.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { stripeRoutes } from './modules/billing/stripe/stripe.routes';
import { cryptomusRoutes } from './modules/billing/cryptomus/cryptomus.routes';
import { orderRoutes } from './modules/orders/orders.routes';
import { providerRoutes } from './modules/providers/providers.routes';
import { apiKeyRoutes } from './modules/api-keys/api-keys.routes';
import { webhookRoutes } from './modules/webhooks/webhooks.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { supportRoutes, adminSupportRoutes } from './modules/support/support.routes';
import { referralRoutes } from './modules/referrals/referrals.routes';
import { couponRoutes, adminCouponRoutes } from './modules/coupons/coupons.routes';
import { adminTrackingRoutes } from './modules/tracking/tracking.routes';

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

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(stripeRoutes, { prefix: '/billing/stripe' });
  await app.register(cryptomusRoutes, { prefix: '/billing/cryptomus' });
  await app.register(orderRoutes, { prefix: '/orders' });
  await app.register(providerRoutes, { prefix: '/providers' });
  await app.register(apiKeyRoutes, { prefix: '/api-keys' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(catalogRoutes, { prefix: '/catalog' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(notificationRoutes, { prefix: '/notifications' });
  await app.register(supportRoutes, { prefix: '/support' });
  await app.register(adminSupportRoutes, { prefix: '/admin/support' });
  await app.register(referralRoutes, { prefix: '/referrals' });
  await app.register(couponRoutes, { prefix: '/coupons' });
  await app.register(adminCouponRoutes, { prefix: '/admin/coupons' });
  await app.register(adminTrackingRoutes, { prefix: '/admin/tracking-links' });

  return app;
}
