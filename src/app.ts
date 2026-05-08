import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { createServiceLogger } from './shared/utils/logger';
import { getConfig } from './shared/config';
import { getPrisma } from './shared/database/prisma';
import { getRedis } from './shared/redis/redis';
import { createRedisCache } from './shared/cache/redis-cache';
import { setupFastifyApp } from './composition/setup-fastify';
import { buildOutboxHandlers } from './composition/outbox-handlers';
import { registerRoutes } from './composition/register-routes';
// prettier-ignore
import { createUserRepository, createTokenRepository, createEmailTokenRepository, createAuthenticate, createAuthService, createAuthEmailService } from './modules/auth';
// prettier-ignore
import { createWalletRepository, createLedgerRepository, createDepositRepository, createBillingService, createBillingInternalService, createDepositLifecycleService, createStripePaymentService, createCryptomusPaymentService, createPaymentProviderRegistry, createDepositExpiryWorker } from './modules/billing';
// prettier-ignore
import { createOutboxRepository, createOutboxService, createOutboxWorker, createHandlerRegistry } from './shared/outbox';
import { createSystemClock } from './shared/utils/clock';
// prettier-ignore
import { createOrdersRepository, createServicesRepository, createOrdersService, createFundSettlement, createCircuitBreaker, createOrderTimeoutWorker, createStatusPollWorker, createDripFeedWorker, stubProviderClient } from './modules/orders';
// prettier-ignore
import { createProvidersRepository, createProvidersService, createEncryptionService, createProviderSelector } from './modules/providers';
import { createApiKeysRepository } from './modules/api-keys/api-keys.repository';
import { createApiKeysService } from './modules/api-keys/api-keys.service';
import { createWebhooksRepository } from './modules/webhooks/webhooks.repository';
import { createWebhooksService } from './modules/webhooks/webhooks.service';
import { createWebhookDispatcher } from './modules/webhooks/webhook-dispatcher';
import { createCatalogRepository } from './modules/catalog/catalog.repository';
import { createCatalogService } from './modules/catalog/catalog.service';
import { createNotificationRepository } from './modules/notifications/notification.repository';
import { createNotificationsService } from './modules/notifications/notifications.service';
import { createNotificationDispatcher } from './modules/notifications/notification-dispatcher';
import { getEmailProvider } from './modules/notifications/utils/email-provider-factory';
import { createSupportRepository } from './modules/support/support.repository';
import { createSupportService } from './modules/support/support.service';
import { createReferralsRepository } from './modules/referrals/referrals.repository';
import { createReferralsService } from './modules/referrals/referrals.service';
import type { ReferralsWalletPort } from './modules/referrals';
import type { LedgerType } from './generated/prisma';
import { createCouponsRepository } from './modules/coupons/coupons.repository';
import { createCouponsService } from './modules/coupons/coupons.service';
import { createTrackingRepository } from './modules/tracking/tracking.repository';
import { createTrackingService } from './modules/tracking/tracking.service';

const log = createServiceLogger('http');

export interface AppWorkers {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreatedApp {
  app: FastifyInstance;
  workers: AppWorkers;
}

export async function createApp(): Promise<CreatedApp> {
  const config = getConfig();
  const app = await setupFastifyApp(
    {
      corsOrigin: config.security.corsOrigin,
      rateLimitMax: config.security.rateLimitMax,
      rateLimitWindowMs: config.security.rateLimitWindowMs,
    },
    log,
  );

  // Composition root — factory-based DI.
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
  const providerSelector = createProviderSelector({
    providersRepo,
    encryption,
    stubClient: stubProviderClient,
    providerMode: config.provider.mode,
    logger: createServiceLogger('provider-selector'),
  });

  const couponsRepo = createCouponsRepository(prisma);
  // prettier-ignore
  const couponsService = createCouponsService({ couponsRepo, logger: createServiceLogger('coupons') });

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

  const webhooksRepo = createWebhooksRepository(prisma);
  // prettier-ignore
  const webhooksService = createWebhooksService({ webhooksRepo, logger: createServiceLogger('webhooks') });
  const webhookDispatcher = createWebhookDispatcher({
    webhooksRepo,
    logger: createServiceLogger('webhook-dispatcher'),
  });

  const apiKeysRepo = createApiKeysRepository(prisma);
  // prettier-ignore
  const apiKeysService = createApiKeysService({ apiKeysRepo, logger: createServiceLogger('api-keys') });

  // Billing module — factory-wired. Repos shared with referrals walletOps adapter.
  const walletRepo = createWalletRepository(prisma);
  const ledgerRepo = createLedgerRepository(prisma);
  const depositRepo = createDepositRepository(prisma);
  const outboxRepo = createOutboxRepository(prisma);
  // prettier-ignore
  const outbox = createOutboxService({ outboxRepo, logger: createServiceLogger('outbox') });
  // prettier-ignore
  const billingService = createBillingService({ walletRepo, ledgerRepo, depositRepo, logger: createServiceLogger('billing') });
  const billingInternal = createBillingInternalService({
    prisma,
    walletRepo,
    ledgerRepo,
    logger: createServiceLogger('billing-internal'),
  });
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

  // Orders module — factory-wired with outbox producer semantics.
  const ordersRepo = createOrdersRepository(prisma);
  const servicesRepo = createServicesRepository(prisma);
  const fundSettlement = createFundSettlement({
    billing: {
      chargeFunds: billingInternal.chargeFunds,
      releaseFunds: billingInternal.releaseFunds,
      refundFunds: billingInternal.refundFunds,
    },
    logger: createServiceLogger('fund-settlement'),
  });
  const circuitBreaker = createCircuitBreaker();
  const ordersService = createOrdersService({
    prisma,
    ordersRepo,
    servicesRepo,
    billing: {
      holdFunds: billingInternal.holdFunds,
      releaseFunds: billingInternal.releaseFunds,
    },
    providerSelector,
    couponsService,
    outbox,
    logger: createServiceLogger('orders'),
  });

  // Workers (lifecycle-only instances; started/stopped via returned workers facade).
  const orderTimeoutWorker = createOrderTimeoutWorker({
    prisma,
    ordersRepo,
    providerSelector,
    stubClient: stubProviderClient,
    fundSettlement,
    outbox,
    config: { orderTimeoutHours: config.polling.orderTimeoutHours },
    logger: createServiceLogger('order-timeout'),
  });
  const statusPollWorker = createStatusPollWorker({
    prisma,
    ordersRepo,
    servicesRepo,
    providerSelector,
    stubClient: stubProviderClient,
    fundSettlement,
    circuitBreaker,
    outbox,
    config: {
      intervalMs: config.polling.intervalMs,
      batchSize: config.polling.batchSize,
      circuitBreakerThreshold: config.polling.circuitBreakerThreshold,
      circuitBreakerCooldownMs: config.polling.circuitBreakerCooldownMs,
    },
    logger: createServiceLogger('status-poll'),
  });
  const dripFeedWorker = createDripFeedWorker({
    ordersRepo,
    servicesRepo,
    providerSelector,
    ordersService,
    logger: createServiceLogger('drip-feed-worker'),
  });
  const depositExpiryWorker = createDepositExpiryWorker({
    depositRepo,
    lifecycle: depositLifecycle,
    logger: createServiceLogger('deposit-expiry'),
  });

  // Outbox handler registry — wires domain events to side-effect producers.
  const handlerRegistry = createHandlerRegistry(
    buildOutboxHandlers({ webhookDispatcher, notificationsService, couponsService }),
  );
  const outboxWorker = createOutboxWorker({
    outboxRepo,
    handlers: handlerRegistry,
    clock: createSystemClock(),
    logger: createServiceLogger('outbox-worker'),
  });

  // Route registration — delegated to registerRoutes to keep this file lean.
  await registerRoutes({
    app,
    authenticate,
    authService,
    authEmailService,
    billingService,
    paymentProviderRegistry,
    stripePayment,
    cryptomusPayment,
    ordersService,
    providersService,
    apiKeysService,
    webhooksService,
    catalogService,
    notificationsService,
    supportService,
    referralsService,
    couponsService,
    trackingService,
  });

  const workers: AppWorkers = {
    async start(): Promise<void> {
      await statusPollWorker.start();
      await dripFeedWorker.start();
      await orderTimeoutWorker.start();
      await depositExpiryWorker.start();
      await webhookDispatcher.start();
      await notificationDispatcher.start();
      outboxWorker.start();
    },
    async stop(): Promise<void> {
      await outboxWorker.stop();
      await notificationDispatcher.stop();
      await webhookDispatcher.stop();
      await depositExpiryWorker.stop();
      await orderTimeoutWorker.stop();
      await dripFeedWorker.stop();
      await statusPollWorker.stop();
    },
  };

  return { app, workers };
}
