import { ApiError } from './client';

const PAYMENT_UNAVAILABLE =
  'Card payments are temporarily unavailable. Please try another payment method or contact support.';
const CRYPTO_UNAVAILABLE =
  'Crypto payments are temporarily unavailable. Please try another payment method or contact support.';

/**
 * Plain error-to-message helper: an `ApiError` surfaces its own message,
 * anything else gets the fallback. No code-based rewriting — use
 * `publicApiErrorMessage` for payment flows that must mask config errors.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function publicApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  switch (error.code) {
    case 'STRIPE_NOT_CONFIGURED':
    case 'STRIPE_SESSION_URL_ERROR':
      return PAYMENT_UNAVAILABLE;
    case 'CRYPTOMUS_NOT_CONFIGURED':
    case 'CRYPTOMUS_CALLBACK_URL_MISSING':
    case 'CRYPTOMUS_API_INVALID_RESPONSE':
    case 'CRYPTOMUS_API_ERROR':
      return CRYPTO_UNAVAILABLE;
    default:
      return error.message;
  }
}
