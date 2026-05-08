import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { createAuthRoutes } from '../modules/auth/auth.routes';
import type { AuthService, AuthEmailService } from '../modules/auth';
import {
  createBillingRoutes,
  createStripeRoutes,
  createCryptomusRoutes,
  type BillingRoutesDeps,
  type StripeRoutesDeps,
  type CryptomusRoutesDeps,
} from '../modules/billing';
import { createOrderRoutes, type OrdersService } from '../modules/orders';
import { createProviderRoutes, type ProvidersService, requireAdmin } from '../modules/providers';
import { createApiKeyRoutes } from '../modules/api-keys/api-keys.routes';
import type { ApiKeysService } from '../modules/api-keys/api-keys.service';
import { createWebhookRoutes } from '../modules/webhooks/webhooks.routes';
import type { WebhooksService } from '../modules/webhooks';
import { createCatalogRoutes } from '../modules/catalog/catalog.routes';
import type { CatalogService } from '../modules/catalog/catalog.service';
import { adminRoutes } from '../modules/admin/admin.routes';
import { createNotificationRoutes } from '../modules/notifications/notifications.routes';
import type { NotificationsService } from '../modules/notifications';
import { createSupportRoutes, createAdminSupportRoutes } from '../modules/support/support.routes';
import type { SupportService } from '../modules/support/support.service';
import { createReferralRoutes } from '../modules/referrals/referrals.routes';
import type { ReferralsService } from '../modules/referrals';
import { createCouponRoutes, createAdminCouponRoutes } from '../modules/coupons/coupons.routes';
import type { CouponsService } from '../modules/coupons';
import { createAdminTrackingRoutes } from '../modules/tracking/tracking.routes';
import type { TrackingService } from '../modules/tracking/tracking.service';

export interface RouteRegistrationDeps {
  app: FastifyInstance;
  authenticate: preHandlerAsyncHookHandler;
  authService: AuthService;
  authEmailService: AuthEmailService;
  billingService: BillingRoutesDeps['service'];
  paymentProviderRegistry: BillingRoutesDeps['providerRegistry'];
  stripePayment: StripeRoutesDeps['service'];
  cryptomusPayment: CryptomusRoutesDeps['service'];
  ordersService: OrdersService;
  providersService: ProvidersService;
  apiKeysService: ApiKeysService;
  webhooksService: WebhooksService;
  catalogService: CatalogService;
  notificationsService: NotificationsService;
  supportService: SupportService;
  referralsService: ReferralsService;
  couponsService: CouponsService;
  trackingService: TrackingService;
}

export async function registerRoutes(deps: RouteRegistrationDeps): Promise<void> {
  const { app, authenticate } = deps;

  await app.register(
    createAuthRoutes({
      authService: deps.authService,
      authEmailService: deps.authEmailService,
      authenticate,
    }),
    { prefix: '/auth' },
  );
  await app.register(
    createBillingRoutes({
      service: deps.billingService,
      providerRegistry: deps.paymentProviderRegistry,
      authenticate,
    }),
    { prefix: '/billing' },
  );
  await app.register(createStripeRoutes({ service: deps.stripePayment, authenticate }), {
    prefix: '/billing/stripe',
  });
  await app.register(createCryptomusRoutes({ service: deps.cryptomusPayment, authenticate }), {
    prefix: '/billing/cryptomus',
  });
  await app.register(createOrderRoutes({ service: deps.ordersService, authenticate }), {
    prefix: '/orders',
  });
  await app.register(
    createProviderRoutes({ service: deps.providersService, authenticate, requireAdmin }),
    { prefix: '/providers' },
  );
  await app.register(createApiKeyRoutes({ service: deps.apiKeysService, authenticate }), {
    prefix: '/api-keys',
  });
  await app.register(createWebhookRoutes({ service: deps.webhooksService, authenticate }), {
    prefix: '/webhooks',
  });
  await app.register(createCatalogRoutes(deps.catalogService), { prefix: '/catalog' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(
    createNotificationRoutes({ service: deps.notificationsService, authenticate }),
    { prefix: '/notifications' },
  );
  await app.register(createSupportRoutes({ service: deps.supportService, authenticate }), {
    prefix: '/support',
  });
  await app.register(
    createAdminSupportRoutes({ service: deps.supportService, authenticate, requireAdmin }),
    { prefix: '/admin/support' },
  );
  await app.register(createReferralRoutes({ service: deps.referralsService, authenticate }), {
    prefix: '/referrals',
  });
  await app.register(createCouponRoutes({ service: deps.couponsService, authenticate }), {
    prefix: '/coupons',
  });
  await app.register(
    createAdminCouponRoutes({ service: deps.couponsService, authenticate, requireAdmin }),
    { prefix: '/admin/coupons' },
  );
  await app.register(
    createAdminTrackingRoutes({ service: deps.trackingService, authenticate, requireAdmin }),
    { prefix: '/admin/tracking-links' },
  );
}
