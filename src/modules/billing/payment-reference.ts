export type PaymentReference =
  | { kind: 'deposit'; depositId: string; userId: string }
  | { kind: 'order-payment'; paymentId: string; userId: string };

/** Compact string form used as the Cryptomus `order_id` (which only round-trips one string). */
export function encodeRef(ref: PaymentReference): string {
  return ref.kind === 'deposit'
    ? `dep:${ref.depositId}:${ref.userId}`
    : `pay:${ref.paymentId}:${ref.userId}`;
}

export function decodeRef(raw: string): PaymentReference | null {
  const parts = raw.split(':');
  if (parts.length !== 3) return null;
  const [tag, id, userId] = parts;
  if (!id || !userId) return null;
  if (tag === 'dep') return { kind: 'deposit', depositId: id, userId };
  if (tag === 'pay') return { kind: 'order-payment', paymentId: id, userId };
  return null;
}
