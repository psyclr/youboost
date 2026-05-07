import { ValidationError } from '../../../shared/errors';
import { createServiceLogger } from '../../../shared/utils/logger';
import { getConfig } from '../../../shared/config';
import * as depositRepo from '../deposit.repository';
import {
  prepareDepositCheckout,
  confirmDepositTransaction,
  failDepositTransaction,
} from '../deposit-lifecycle.service';
import type { PaymentProvider, CreateCheckoutInput, CheckoutResult } from '../providers/types';
import { signRequestBody, verifyWebhookSignature, extractSignFromBody } from './cryptomus.crypto';

const log = createServiceLogger('cryptomus');

const CRYPTOMUS_API = 'https://api.cryptomus.com/v1/payment';
const PROVIDER_LABEL = 'Cryptomus';

export interface CheckoutSessionResponse {
  orderId: string;
  url: string;
  depositId: string;
}

interface CryptomusCreatePaymentResult {
  uuid: string;
  order_id: string;
  url: string;
  [key: string]: unknown;
}

interface CryptomusApiResponse<T> {
  state?: number;
  result?: T;
  message?: string;
  errors?: unknown;
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

function getCreds(): { merchantId: string; paymentKey: string } {
  const { cryptomus } = getConfig();
  if (!cryptomus.merchantId || !cryptomus.paymentKey) {
    throw new ValidationError('Cryptomus is not configured', 'CRYPTOMUS_NOT_CONFIGURED');
  }
  return {
    merchantId: cryptomus.merchantId,
    paymentKey: cryptomus.paymentKey,
  };
}

export async function createCheckoutSession(
  userId: string,
  input: { amount: number },
): Promise<CheckoutSessionResponse> {
  const { merchantId, paymentKey } = getCreds();
  const config = getConfig();
  const callbackUrl = config.cryptomus.callbackUrl;
  if (!callbackUrl) {
    throw new ValidationError(
      'Cryptomus callback URL is not configured',
      'CRYPTOMUS_CALLBACK_URL_MISSING',
    );
  }

  const deposit = await prepareDepositCheckout(userId, input.amount);

  const body = {
    amount: input.amount.toFixed(2),
    currency: 'USD',
    order_id: deposit.id,
    url_callback: `${callbackUrl.replace(/\/$/, '')}/billing/cryptomus/webhook`,
    url_return: `${config.app.url}/billing?deposit=success`,
    url_success: `${config.app.url}/billing?deposit=success`,
  };
  const bodyJson = JSON.stringify(body);
  const sign = signRequestBody(bodyJson, paymentKey);

  const response = await fetch(CRYPTOMUS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: merchantId,
      sign,
    },
    body: bodyJson,
  });

  const raw = await response.text();
  let parsed: CryptomusApiResponse<CryptomusCreatePaymentResult>;
  try {
    parsed = JSON.parse(raw) as CryptomusApiResponse<CryptomusCreatePaymentResult>;
  } catch {
    log.error({ status: response.status, raw }, 'Cryptomus returned non-JSON response');
    throw new ValidationError(
      'Cryptomus payment creation failed',
      'CRYPTOMUS_API_INVALID_RESPONSE',
    );
  }

  if (!response.ok || !parsed.result?.url || !parsed.result.order_id) {
    log.error(
      { status: response.status, message: parsed.message, errors: parsed.errors },
      'Cryptomus create payment failed',
    );
    throw new ValidationError(
      parsed.message ?? 'Cryptomus payment creation failed',
      'CRYPTOMUS_API_ERROR',
    );
  }

  await depositRepo.updateDepositCryptomusOrder(deposit.id, {
    cryptomusOrderId: parsed.result.order_id,
    cryptomusCheckoutUrl: parsed.result.url,
  });

  log.info(
    { userId, depositId: deposit.id, cryptomusUuid: parsed.result.uuid },
    'Cryptomus checkout session created',
  );

  return {
    orderId: parsed.result.order_id,
    url: parsed.result.url,
    depositId: deposit.id,
  };
}

export async function handleWebhookEvent(rawBody: string): Promise<void> {
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
    log.warn({ payload }, 'Cryptomus webhook missing order_id or status');
    return;
  }

  const deposit = await depositRepo.findDepositByCryptomusOrderId(orderId);
  if (!deposit) {
    log.warn({ orderId }, 'Cryptomus webhook for unknown deposit');
    return;
  }

  // Replay protection: Cryptomus webhook payload has no timestamp field,
  // so we reject webhooks targeting deposits past their expiry window.
  // Paired with confirmDepositTransaction idempotency (PENDING-only guard),
  // this prevents stale webhooks from re-crediting expired deposits.
  if (deposit.expiresAt && deposit.expiresAt < new Date() && deposit.status !== 'PENDING') {
    log.warn(
      { orderId, depositId: deposit.id, expiresAt: deposit.expiresAt, status: deposit.status },
      'Cryptomus webhook for already-resolved expired deposit — ignoring as replay',
    );
    return;
  }

  if (CONFIRMED_STATUSES.has(status)) {
    await confirmDepositTransaction(deposit.id, deposit.userId, PROVIDER_LABEL);
    return;
  }

  if (FAILED_STATUSES.has(status)) {
    await failDepositTransaction(deposit.id, PROVIDER_LABEL, status);
    return;
  }

  log.debug({ orderId, status }, 'Cryptomus webhook non-terminal status');
}

export const cryptomusProvider: PaymentProvider = {
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
    const { cryptomus } = getConfig();
    return Boolean(cryptomus.merchantId) && Boolean(cryptomus.paymentKey);
  },
};
