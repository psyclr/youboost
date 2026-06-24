import type { WebhookDispatcher } from '../modules/webhooks/webhook-dispatcher';
import type { NotificationsService, EmailProvider } from '../modules/notifications';
import type { CouponsService } from '../modules/coupons';
import type { ReferralsService } from '../modules/referrals';
import {
  createOrderCreatedWebhookHandler,
  createOrderCancelledWebhookHandler,
  createOrderCompletedWebhookHandler,
  createOrderFailedWebhookHandler,
  createOrderPartialWebhookHandler,
  createDepositConfirmedWebhookHandler,
  createDepositFailedWebhookHandler,
} from '../modules/webhooks';
import {
  createOrderCreatedEmailHandler,
  createOrderCancelledEmailHandler,
  createOrderCompletedEmailHandler,
  createOrderPartialEmailHandler,
  createDepositConfirmedEmailHandler,
  createDepositFailedEmailHandler,
  createVerificationEmailHandler,
  createPasswordResetEmailHandler,
  createAutoUserSetupEmailHandler,
  createAdminFulfilmentExhaustedHandler,
} from '../modules/notifications';
import { createCouponUsedHandler } from '../modules/coupons';
import { createReferralAppliedHandler } from '../modules/referrals';
import {
  createPurchaseConversionHandler,
  createDepositConversionHandler,
  createYandexMetrikaClient,
  type YandexMetrikaClient,
} from '../modules/analytics';
import { createHandlerRegistry, type OutboxHandler, type HandlerRegistry } from '../shared/outbox';
import type { Logger } from 'pino';
import { createServiceLogger } from '../shared/utils/logger';

export interface OutboxHandlerDeps {
  webhookDispatcher: WebhookDispatcher;
  notificationsService: NotificationsService;
  couponsService: CouponsService;
  referralsService: ReferralsService;
  emailProvider: EmailProvider;
  metrikaClient: YandexMetrikaClient;
  metrikaTargets: { purchase: string; deposit: string };
  adminEmail: string | undefined;
}

export function buildOutboxHandlers(deps: OutboxHandlerDeps): OutboxHandler[] {
  const {
    webhookDispatcher,
    notificationsService,
    couponsService,
    referralsService,
    emailProvider,
    metrikaClient,
    metrikaTargets,
    adminEmail,
  } = deps;
  const mk = (name: string): Logger => createServiceLogger(name);

  return [
    createOrderCreatedWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:order-created-webhook'),
    }),
    createOrderCancelledWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:order-cancelled-webhook'),
    }),
    createOrderCompletedWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:order-completed-webhook'),
    }),
    createOrderFailedWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:order-failed-webhook'),
    }),
    createOrderPartialWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:order-partial-webhook'),
    }),
    createDepositConfirmedWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:deposit-confirmed-webhook'),
    }),
    createDepositFailedWebhookHandler({
      webhookDispatcher,
      logger: mk('outbox:deposit-failed-webhook'),
    }),
    createOrderCreatedEmailHandler({
      notificationsService,
      logger: mk('outbox:order-created-email'),
    }),
    createOrderCancelledEmailHandler({
      notificationsService,
      logger: mk('outbox:order-cancelled-email'),
    }),
    createOrderCompletedEmailHandler({
      notificationsService,
      logger: mk('outbox:order-completed-email'),
    }),
    createOrderPartialEmailHandler({
      notificationsService,
      logger: mk('outbox:order-partial-email'),
    }),
    createDepositConfirmedEmailHandler({
      notificationsService,
      logger: mk('outbox:deposit-confirmed-email'),
    }),
    createDepositFailedEmailHandler({
      notificationsService,
      logger: mk('outbox:deposit-failed-email'),
    }),
    createVerificationEmailHandler({
      emailProvider,
      logger: mk('outbox:verification-email'),
    }),
    createPasswordResetEmailHandler({
      emailProvider,
      logger: mk('outbox:password-reset-email'),
    }),
    createAutoUserSetupEmailHandler({
      emailProvider,
      logger: mk('outbox:auto-user-setup-email'),
    }),
    createCouponUsedHandler({ couponsService, logger: mk('outbox:coupon-used') }),
    createReferralAppliedHandler({
      referralsService,
      logger: mk('outbox:referral-applied'),
    }),
    createPurchaseConversionHandler({
      metrikaClient,
      target: metrikaTargets.purchase,
      logger: mk('outbox:purchase-conversion'),
    }),
    createDepositConversionHandler({
      metrikaClient,
      target: metrikaTargets.deposit,
      logger: mk('outbox:deposit-conversion'),
    }),
    createAdminFulfilmentExhaustedHandler({
      emailProvider,
      adminEmail,
      logger: mk('outbox:admin-fulfilment-exhausted'),
    }),
  ] as OutboxHandler[];
}

export interface HandlerRegistryDeps {
  webhookDispatcher: WebhookDispatcher;
  notificationsService: NotificationsService;
  couponsService: CouponsService;
  referralsService: ReferralsService;
  emailProvider: EmailProvider;
  metrika: {
    counterId: string;
    oauthToken: string | undefined;
    purchaseTarget: string;
    depositTarget: string;
  };
  adminEmail: string | undefined;
}

/**
 * Compose the outbox handler registry: build the Metrika client (server-side
 * analytics) and wire every domain-event handler. Owning this here keeps the
 * app composition root focused on service construction.
 */
export function buildHandlerRegistry(deps: HandlerRegistryDeps): HandlerRegistry {
  const metrikaClient = createYandexMetrikaClient({
    config: { counterId: deps.metrika.counterId, oauthToken: deps.metrika.oauthToken },
    logger: createServiceLogger('yandex-metrika'),
  });
  return createHandlerRegistry(
    buildOutboxHandlers({
      webhookDispatcher: deps.webhookDispatcher,
      notificationsService: deps.notificationsService,
      couponsService: deps.couponsService,
      referralsService: deps.referralsService,
      emailProvider: deps.emailProvider,
      metrikaClient,
      metrikaTargets: { purchase: deps.metrika.purchaseTarget, deposit: deps.metrika.depositTarget },
      adminEmail: deps.adminEmail,
    }),
  );
}
