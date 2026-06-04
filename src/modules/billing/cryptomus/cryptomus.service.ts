import type { Logger } from 'pino';
import { ValidationError } from '../../../shared/errors';
import type { DepositRepository } from '../deposit.repository';
import type { DepositLifecycleService } from '../deposit-lifecycle.service';
import type { PaymentProvider, CreateCheckoutInput, CheckoutResult } from '../providers/types';
import type { PaymentReference } from '../payment-reference';
import { encodeRef, decodeRef } from '../payment-reference';
import { verifyWebhookSignature, extractSignFromBody } from './cryptomus.crypto';
import { createCryptomusPayment } from './cryptomus.client';

const PROVIDER_LABEL = 'Cryptomus';

export interface CheckoutSessionResponse {
  orderId: string;
  url: string;
  depositId: string;
}

export interface GuestOrderSessionResponse {
  sessionId: string;
  url: string;
}

interface CryptomusWebhookBody {
  order_id?: string;
  status?: string;
  amount?: string;
  uuid?: string;
  [key: string]: unknown;
}

const CONFIRMED_STATUSES = new Set(['paid', 'paid_over']);
const FAILED_STATUSES = new Set(['fail', 'cancel', 'wrong_amount', 'system_fail']);

export interface PaymentSessionInput {
  amount: number;
  productName: string;
  reference: PaymentReference;
  successUrl: string;
  cancelUrl: string;
}

export interface CryptomusPaymentService {
  readonly provider: PaymentProvider;
  createCheckoutSession(
    userId: string,
    input: { amount: number },
  ): Promise<CheckoutSessionResponse>;
  createPaymentSession(input: PaymentSessionInput): Promise<GuestOrderSessionResponse>;
  handleWebhookEvent(rawBody: string): Promise<void>;
}

export interface CryptomusPaymentServiceDeps {
  depositRepo: DepositRepository;
  lifecycle: DepositLifecycleService;
  /**
   * Called when a completed Cryptomus webhook carries an order-payment reference.
   * Optional to keep existing test harnesses that exercise only the deposit path
   * constructing the service unchanged.
   */
  confirmOrderPayment?: (paymentId: string) => Promise<void>;
  cryptomusConfig: {
    merchantId: string | undefined;
    paymentKey: string | undefined;
    callbackUrl: string | undefined;
  };
  appUrl: string;
  logger: Logger;
}

export function createCryptomusPaymentService(
  deps: CryptomusPaymentServiceDeps,
): CryptomusPaymentService {
  const { depositRepo, lifecycle, confirmOrderPayment, cryptomusConfig, appUrl, logger } = deps;

  function getCreds(): { merchantId: string; paymentKey: string } {
    if (!cryptomusConfig.merchantId || !cryptomusConfig.paymentKey) {
      throw new ValidationError(
        'Crypto payments are temporarily unavailable. Please try another payment method or contact support.',
        'CRYPTOMUS_NOT_CONFIGURED',
      );
    }
    return {
      merchantId: cryptomusConfig.merchantId,
      paymentKey: cryptomusConfig.paymentKey,
    };
  }

  function getCallbackBase(): string {
    const callbackUrl = cryptomusConfig.callbackUrl;
    if (!callbackUrl) {
      throw new ValidationError(
        'Cryptomus callback URL is not configured',
        'CRYPTOMUS_CALLBACK_URL_MISSING',
      );
    }
    return `${callbackUrl.replace(/\/$/, '')}/billing/cryptomus/webhook`;
  }

  async function createCheckoutSession(
    userId: string,
    input: { amount: number },
  ): Promise<CheckoutSessionResponse> {
    const creds = getCreds();
    const urlCallback = getCallbackBase();
    const deposit = await lifecycle.prepareDepositCheckout(userId, input.amount);

    const result = await createCryptomusPayment(
      creds,
      {
        amount: input.amount.toFixed(2),
        currency: 'USD',
        order_id: deposit.id,
        url_callback: urlCallback,
        url_return: `${appUrl}/billing?deposit=success`,
        url_success: `${appUrl}/billing?deposit=success`,
      },
      { logger, errorMessage: 'Cryptomus payment creation failed' },
    );

    await depositRepo.updateDepositCryptomusOrder(deposit.id, {
      cryptomusOrderId: result.order_id,
      cryptomusCheckoutUrl: result.url,
    });

    logger.info(
      { userId, depositId: deposit.id, cryptomusUuid: result.uuid },
      'Cryptomus checkout session created',
    );

    return { orderId: result.order_id, url: result.url, depositId: deposit.id };
  }

  async function createPaymentSession(
    input: PaymentSessionInput,
  ): Promise<GuestOrderSessionResponse> {
    const creds = getCreds();
    const result = await createCryptomusPayment(
      creds,
      {
        amount: input.amount.toFixed(2),
        currency: 'USD',
        order_id: encodeRef(input.reference),
        url_callback: getCallbackBase(),
        url_return: input.cancelUrl,
        url_success: input.successUrl,
      },
      { logger, errorMessage: 'Crypto checkout failed' },
    );

    logger.info(
      { reference: input.reference.kind, cryptomusUuid: result.uuid },
      'Cryptomus payment session created',
    );

    return { sessionId: result.order_id, url: result.url };
  }

  async function handleWebhookEvent(rawBody: string): Promise<void> {
    const { paymentKey } = getCreds();

    if (!verifyWebhookSignature(rawBody, paymentKey)) {
      throw new ValidationError(
        'Invalid Cryptomus webhook signature',
        'CRYPTOMUS_WEBHOOK_INVALID_SIGNATURE',
      );
    }

    const { unsignedJson } = extractSignFromBody(rawBody);
    const payload = JSON.parse(unsignedJson) as CryptomusWebhookBody;

    const orderId = payload.order_id;
    const status = payload.status;
    if (!orderId || !status) {
      logger.warn({ payload }, 'Cryptomus webhook missing order_id or status');
      return;
    }

    // Intentional asymmetry vs Stripe: Stripe encodes BOTH deposit and
    // order-payment as references, so its webhook collapses to
    // `completionRouter.handle(ref)`. Cryptomus only encodes order-payment as a
    // reference; deposits use a bare deposit-id `order_id` resolved by DB lookup
    // plus replay/expiry protection (handleDepositWebhook), which the generic
    // router cannot express. So order-payment dispatches directly to
    // confirmOrderPayment here and deposits fall through to the bespoke path.
    //
    // order-payment path: order_id is an encoded PaymentReference (pay:<id>:<user>)
    const ref = decodeRef(orderId);
    if (ref && ref.kind === 'order-payment') {
      if (!CONFIRMED_STATUSES.has(status)) {
        logger.debug({ orderId, status }, 'Cryptomus order-payment webhook non-confirmed status');
        return;
      }
      if (!confirmOrderPayment) {
        logger.warn({ orderId }, 'Cryptomus confirmOrderPayment handler is not wired');
        return;
      }
      await confirmOrderPayment(ref.paymentId);
      return;
    }

    // deposit path: fall through to the existing deposit-by-order-id logic
    const deposit = await depositRepo.findDepositByCryptomusOrderId(orderId);
    if (!deposit) {
      logger.warn({ orderId }, 'Cryptomus webhook for unknown deposit');
      return;
    }

    await handleDepositWebhook(deposit, orderId, status);
  }

  async function handleDepositWebhook(
    deposit: NonNullable<Awaited<ReturnType<DepositRepository['findDepositByCryptomusOrderId']>>>,
    orderId: string,
    status: string,
  ): Promise<void> {
    // Replay protection: Cryptomus webhook payload has no timestamp field,
    // so we reject webhooks targeting deposits past their expiry window.
    // Paired with confirmDepositTransaction idempotency (PENDING-only guard),
    // this prevents stale webhooks from re-crediting expired deposits.
    if (deposit.expiresAt && deposit.expiresAt < new Date() && deposit.status !== 'PENDING') {
      logger.warn(
        { orderId, depositId: deposit.id, expiresAt: deposit.expiresAt, status: deposit.status },
        'Cryptomus webhook for already-resolved expired deposit — ignoring as replay',
      );
      return;
    }

    if (CONFIRMED_STATUSES.has(status)) {
      await lifecycle.confirmDepositTransaction(deposit.id, deposit.userId, PROVIDER_LABEL);
      return;
    }

    if (FAILED_STATUSES.has(status)) {
      await lifecycle.failDepositTransaction(deposit.id, PROVIDER_LABEL, status);
      return;
    }

    logger.debug({ orderId, status }, 'Cryptomus webhook non-terminal status');
  }

  const provider: PaymentProvider = {
    id: 'cryptomus',
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
      const res = await createCheckoutSession(input.userId, { amount: input.amount });
      return {
        checkoutId: res.orderId,
        url: res.url,
        depositId: res.depositId,
      };
    },
    async handleWebhook(rawBody: string): Promise<void> {
      await handleWebhookEvent(rawBody);
    },
    isConfigured(): boolean {
      return Boolean(cryptomusConfig.merchantId) && Boolean(cryptomusConfig.paymentKey);
    },
  };

  return {
    provider,
    createCheckoutSession,
    createPaymentSession,
    handleWebhookEvent,
  };
}
