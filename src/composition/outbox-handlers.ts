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
  createOrderFailedEmailHandler,
  createOrderPartialEmailHandler,
  createDepositConfirmedEmailHandler,
  createDepositFailedEmailHandler,
  createVerificationEmailHandler,
  createPasswordResetEmailHandler,
} from '../modules/notifications';
import { createCouponUsedHandler } from '../modules/coupons';
import { createReferralAppliedHandler } from '../modules/referrals';
import type { OutboxHandler } from '../shared/outbox';
import type { Logger } from 'pino';
import { createServiceLogger } from '../shared/utils/logger';

export interface OutboxHandlerDeps {
  webhookDispatcher: WebhookDispatcher;
  notificationsService: NotificationsService;
  couponsService: CouponsService;
  referralsService: ReferralsService;
  emailProvider: EmailProvider;
}

export function buildOutboxHandlers(deps: OutboxHandlerDeps): OutboxHandler[] {
  const {
    webhookDispatcher,
    notificationsService,
    couponsService,
    referralsService,
    emailProvider,
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
    createOrderFailedEmailHandler({
      notificationsService,
      logger: mk('outbox:order-failed-email'),
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
    createCouponUsedHandler({ couponsService, logger: mk('outbox:coupon-used') }),
    createReferralAppliedHandler({
      referralsService,
      logger: mk('outbox:referral-applied'),
    }),
  ] as OutboxHandler[];
}
