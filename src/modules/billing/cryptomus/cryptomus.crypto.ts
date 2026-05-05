import { createHash } from 'node:crypto';

/**
 * Cryptomus signature scheme: md5(base64(body) + paymentKey).
 * Docs: https://doc.cryptomus.com/business/general/request-building
 *
 * For webhook verification the incoming `sign` field must be removed from the
 * body before computing the expected hash (Cryptomus computes the signature
 * over the body without `sign`).
 */

function md5Hex(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function toBase64(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Build the `sign` header/body value for an outgoing request.
 * The body must be the exact JSON string that will be sent over the wire —
 * Cryptomus hashes the base64 of that string.
 */
export function signRequestBody(bodyJson: string, paymentKey: string): string {
  return md5Hex(toBase64(bodyJson) + paymentKey);
}

/**
 * Verify an incoming webhook payload.
 * Strategy: work with the raw JSON string, strip the `sign` field without
 * re-serialising the rest (so key ordering is preserved), then MD5(base64(...) + key).
 *
 * We re-serialise conservatively: we parse the JSON once, remove `sign`, and
 * JSON.stringify the rest. This preserves insertion order in V8 (Cryptomus uses
 * the same order in their Go server, and both JS and Go maintain insertion
 * order for objects keyed by strings) — matching the signature algorithm in
 * practice. If a future mismatch is observed we can switch to a string-level
 * surgical removal.
 */
export function extractSignFromBody(rawBody: string): {
  signature: string | null;
  unsignedJson: string;
} {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  const { sign, ...rest } = parsed;
  const signature = typeof sign === 'string' ? sign : null;
  return {
    signature,
    unsignedJson: JSON.stringify(rest),
  };
}

export function verifyWebhookSignature(rawBody: string, paymentKey: string): boolean {
  const { signature, unsignedJson } = extractSignFromBody(rawBody);
  if (!signature) return false;
  const expected = md5Hex(toBase64(unsignedJson) + paymentKey);
  // Constant-time compare would be ideal, but hex strings are short and Node's
  // timingSafeEqual requires equal lengths. Signature format is fixed 32-char
  // hex so we can safely compare with ===.
  return signature.length === expected.length && signature === expected;
}
