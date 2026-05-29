import type { Logger } from 'pino';
import { ValidationError } from '../../../shared/errors';
import { signRequestBody } from './cryptomus.crypto';

const CRYPTOMUS_API = 'https://api.cryptomus.com/v1/payment';

export interface CryptomusCreatePaymentResult {
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

export interface CryptomusCreatePaymentBody {
  amount: string;
  currency: string;
  order_id: string;
  url_callback: string;
  url_return: string;
  url_success: string;
}

/**
 * Sign + POST a create-payment request to Cryptomus and validate the response.
 * Shared by deposit, guest-order, and Payment session flows.
 */
export async function createCryptomusPayment(
  creds: { merchantId: string; paymentKey: string },
  body: CryptomusCreatePaymentBody,
  opts: { logger: Logger; errorMessage: string },
): Promise<CryptomusCreatePaymentResult> {
  const { logger, errorMessage } = opts;
  const bodyJson = JSON.stringify(body);
  const sign = signRequestBody(bodyJson, creds.paymentKey);

  const response = await fetch(CRYPTOMUS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: creds.merchantId,
      sign,
    },
    body: bodyJson,
  });

  const raw = await response.text();
  let parsed: CryptomusApiResponse<CryptomusCreatePaymentResult>;
  try {
    parsed = JSON.parse(raw) as CryptomusApiResponse<CryptomusCreatePaymentResult>;
  } catch {
    logger.error({ status: response.status, raw }, 'Cryptomus returned non-JSON response');
    throw new ValidationError(errorMessage, 'CRYPTOMUS_API_INVALID_RESPONSE');
  }

  if (!response.ok || !parsed.result?.url || !parsed.result.order_id) {
    logger.error(
      { status: response.status, message: parsed.message, errors: parsed.errors },
      'Cryptomus create payment failed',
    );
    throw new ValidationError(parsed.message ?? errorMessage, 'CRYPTOMUS_API_ERROR');
  }

  return parsed.result;
}
