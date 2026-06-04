import type { PaymentReference } from '../payment-reference';

/** Encode a PaymentReference into Stripe checkout-session metadata. */
export function stripeEncodeMetadata(ref: PaymentReference): Record<string, string> {
  return ref.kind === 'deposit'
    ? { kind: 'deposit', depositId: ref.depositId, userId: ref.userId }
    : { kind: 'order-payment', paymentId: ref.paymentId, userId: ref.userId };
}

/**
 * Decode a PaymentReference from Stripe session metadata. Accepts legacy
 * deposit metadata that has `depositId`/`userId` but no `kind`.
 */
export function stripeDecodeReference(
  meta: Record<string, unknown> | null | undefined,
): PaymentReference | null {
  if (!meta) return null;
  const userId = typeof meta['userId'] === 'string' ? meta['userId'] : null;
  if (!userId) return null;
  const kind = meta['kind'];
  if (kind === 'order-payment' && typeof meta['paymentId'] === 'string') {
    return { kind: 'order-payment', paymentId: meta['paymentId'], userId };
  }
  // deposit: explicit kind OR legacy (depositId present, no kind)
  if ((kind === 'deposit' || kind === undefined) && typeof meta['depositId'] === 'string') {
    return { kind: 'deposit', depositId: meta['depositId'], userId };
  }
  return null;
}
