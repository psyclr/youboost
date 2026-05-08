import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import { openapiSpec } from './shared/swagger/openapi-spec';
import { AppError } from './shared/errors/app-error';
import { checkHealth } from './shared/health/health';
import { createServiceLogger } from './shared/utils/logger';
import { getConfig } from './shared/config';
import { getPrisma } from './shared/database/prisma';
import { getRedis } from './shared/redis/redis';
import { createRedisCache } from './shared/cache/redis-cache';
// prettier-ignore
import { createUserRepository, createTokenRepository, createEmailTokenRepository, createAuthenticate, createAuthService, createAuthEmailService } from './modules/auth';
import { createAuthRoutes } from './modules/auth/auth.routes';
// prettier-ignore
import { createWalletRepository, createLedgerRepository, createDepositRepository, createBillingService, createDepositLifecycleService, createStripePaymentService, createCryptomusPaymentService, createPaymentProviderRegistry, createBillingRoutes, createStripeRoutes, createCryptomusRoutes } from './modules/billing';
import { createOutboxRepository, createOutboxService } from './shared/outbox';
import { orderRoutes } from './modules/orders/orders.routes';
// prettier-ignore
import { createProvidersRepository, createProvidersService, createProviderRoutes, createEncryptionService, requireAdmin } from './modules/providers';
import { createApiKeysRepository } from './modules/api-keys/api-keys.repository';
import { createApiKeysService } from './modules/api-keys/api-keys.service';
import { createApiKeyRoutes } from './modules/api-keys/api-keys.routes';
import { createWebhooksRepository } from './modules/webhooks/webhooks.repository';
import { createWebhooksService } from './modules/webhooks/webhooks.service';
import { createWebhookRoutes } from './modules/webhooks/webhooks.routes';
import { createCatalogRepository } from './modules/catalog/catalog.repository';
import { createCatalogService } from './modules/catalog/catalog.service';
import { createCatalogRoutes } from './modules/catalog/catalog.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { createNotificationRepository } from './modules/notifications/notification.repository';
import { createNotificationsService } from './modules/notifications/notifications.service';
import { createNotificationDispatcher } from './modules/notifications/notification-dispatcher';
import { createNotificationRoutes } from './modules/notifications/notifications.routes';
import { getEmailProvider } from './modules/notifications/utils/email-provider-factory';
import { createSupportRepository } from './modules/support/support.repository';
import { createSupportService } from './modules/support/support.service';
import { createSupportRoutes, createAdminSupportRoutes } from './modules/support/support.routes';
import { createReferralsRepository } from './modules/referrals/referrals.repository';
import { createReferralsService } from './modules/referrals/referrals.service';
import { createReferralRoutes } from './modules/referrals/referrals.routes';
import type { ReferralsWalletPort } from './modules/referrals';
import type { LedgerType } from './generated/prisma';
import { createCouponsRepository } from './modules/coupons/coupons.repository';
import { createCouponsService } from './modules/coupons/coupons.service';
import { createCouponRoutes, createAdminCouponRoutes } from './modules/coupons/coupons.routes';
import { createTrackingRepository } from './modules/tracking/tracking.repository';
import { createTrackingService } from './modules/tracking/tracking.service';
import { createAdminTrackingRoutes } from './modules/tracking/tracking.routes';

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

  // Composition root — factory-based DI. Unconverted modules still use singletons.
  const prisma = getPrisma();
  const redis = getRedis();
  const cache = createRedisCache(redis);

  // Auth repos + middleware wired early; services wired below (need notifications + referrals).
  const userRepo = createUserRepository(prisma);
  const tokenRepo = createTokenRepository(prisma);
  const emailTokenRepo = createEmailTokenRepository(prisma);
  const authenticate = createAuthenticate({ tokenStore: tokenRepo });

  const catalogRepo = createCatalogRepository(prisma);
  // prettier-ignore
  const catalogService = createCatalogService({ catalogRepo, cache, logger: createServiceLogger('catalog') });

  const trackingRepo = createTrackingRepository(prisma);
  // prettier-ignore
  const trackingService = createTrackingService({ trackingRepo, logger: createServiceLogger('tracking') });

  const supportRepo = createSupportRepository(prisma);
  // prettier-ignore
  const supportService = createSupportService({ supportRepo, logger: createServiceLogger('support') });

  const providersRepo = createProvidersRepository(prisma);
  const encryption = createEncryptionService({ encryptionKey: config.provider.encryptionKey });
  // prettier-ignore
  const providersService = createProvidersService({ providersRepo, encryption, logger: createServiceLogger('providers') });

  const couponsRepo = createCouponsRepository(prisma);
  const couponsService = createCouponsService({
    couponsRepo,
    logger: createServiceLogger('coupons'),
  });

  const emailProvider = getEmailProvider();
  const notificationRepo = createNotificationRepository(prisma);
  const notificationDispatcher = createNotificationDispatcher({
    notificationRepo,
    emailProvider,
    logger: createServiceLogger('notification-dispatcher'),
  });
  const notificationsService = createNotificationsService({
    notificationRepo,
    enqueueNotificationJob: notificationDispatcher.enqueueNotification,
    logger: createServiceLogger('notifications'),
  });

  // webhookDispatcher still lives in webhooks/index.ts shim (inlined in F17).
  const webhooksRepo = createWebhooksRepository(prisma);
  const webhooksService = createWebhooksService({
    webhooksRepo,
    logger: createServiceLogger('webhooks'),
  });

  const apiKeysRepo = createApiKeysRepository(prisma);
  const apiKeysService = createApiKeysService({
    apiKeysRepo,
    logger: createServiceLogger('api-keys'),
  });

  // Billing module — factory-wired. Repos shared with referrals walletOps adapter.
  const walletRepo = createWalletRepository(prisma);
  const ledgerRepo = createLedgerRepository(prisma);
  const depositRepo = createDepositRepository(prisma);
  const outboxRepo = createOutboxRepository(prisma);
  // prettier-ignore
  const outbox = createOutboxService({ outboxRepo, logger: createServiceLogger('outbox') });
  // prettier-ignore
  const billingService = createBillingService({ walletRepo, ledgerRepo, depositRepo, logger: createServiceLogger('billing') });
  // prettier-ignore
  const depositLifecycle = createDepositLifecycleService({ prisma, walletRepo, ledgerRepo, depositRepo, outbox, billingConfig: config.billing, logger: createServiceLogger('deposit-lifecycle') });
  // prettier-ignore
  const stripePayment = createStripePaymentService({ stripeClient: config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null, depositRepo, lifecycle: depositLifecycle, stripeConfig: config.stripe, appUrl: config.app.url, logger: createServiceLogger('stripe') });
  // prettier-ignore
  const cryptomusPayment = createCryptomusPaymentService({ depositRepo, lifecycle: depositLifecycle, cryptomusConfig: config.cryptomus, appUrl: config.app.url, logger: createServiceLogger('cryptomus') });
  // prettier-ignore
  const paymentProviderRegistry = createPaymentProviderRegistry([stripePayment.provider, cryptomusPayment.provider]);

  const referralsRepo = createReferralsRepository(prisma);
  // Port uses `string` for ledger type; billing expects LedgerType enum. Service
  // only ever passes 'DEPOSIT' which is a valid member, so we cast at the boundary.
  const referralsWalletOps: ReferralsWalletPort = {
    getOrCreateWallet: (userId) => walletRepo.getOrCreateWallet(userId),
    updateBalance: async (args) => {
      await walletRepo.updateBalance(args);
    },
    createLedgerEntry: async (data, tx) => {
      await ledgerRepo.createLedgerEntry({ ...data, type: data.type as LedgerType }, tx);
    },
  };
  // prettier-ignore
  const referralsService = createReferralsService({ referralsRepo, walletOps: referralsWalletOps, prisma, logger: createServiceLogger('referrals') });

  // prettier-ignore
  const authEmailService = createAuthEmailService({ userRepo, emailTokenRepo, emailProvider, appUrl: config.app.url, logger: createServiceLogger('auth-email') });
  // prettier-ignore
  const authService = createAuthService({ userRepo, tokenStore: tokenRepo, sendVerificationEmail: authEmailService.sendVerificationEmail, applyReferral: referralsService.applyReferral, logger: createServiceLogger('auth') });

  await app.register(createAuthRoutes({ authService, authEmailService, authenticate }), {
    prefix: '/auth',
  });
  // prettier-ignore
  await app.register(createBillingRoutes({ service: billingService, providerRegistry: paymentProviderRegistry, authenticate }), { prefix: '/billing' });
  // prettier-ignore
  await app.register(createStripeRoutes({ service: stripePayment, authenticate }), { prefix: '/billing/stripe' });
  // prettier-ignore
  await app.register(createCryptomusRoutes({ service: cryptomusPayment, authenticate }), { prefix: '/billing/cryptomus' });
  await app.register(orderRoutes, { prefix: '/orders' });
  // prettier-ignore
  await app.register(createProviderRoutes({ service: providersService, authenticate, requireAdmin }), { prefix: '/providers' });
  await app.register(createApiKeyRoutes({ service: apiKeysService, authenticate }), {
    prefix: '/api-keys',
  });
  await app.register(createWebhookRoutes({ service: webhooksService, authenticate }), {
    prefix: '/webhooks',
  });
  await app.register(createCatalogRoutes(catalogService), { prefix: '/catalog' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(createNotificationRoutes({ service: notificationsService, authenticate }), {
    prefix: '/notifications',
  });
  await app.register(createSupportRoutes({ service: supportService, authenticate }), {
    prefix: '/support',
  });
  await app.register(
    createAdminSupportRoutes({ service: supportService, authenticate, requireAdmin }),
    { prefix: '/admin/support' },
  );
  await app.register(createReferralRoutes({ service: referralsService, authenticate }), {
    prefix: '/referrals',
  });
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
