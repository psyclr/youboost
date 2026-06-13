// Allowlist for payment-provider checkout redirect hosts. The backend returns
// a checkout URL and the frontend must never navigate to an untrusted host,
// even if the API response is compromised (exact-match or dot-prefixed
// subdomain only — "evilstripe.com" must NOT pass). Asserted by e2e:
// landing-cart "rejects a checkout redirect to an untrusted host" and
// billing-deposit tests 6/8.

export function isTrustedStripeHost(hostname: string): boolean {
  return hostname === 'checkout.stripe.com' || hostname.endsWith('.stripe.com');
}

export function isTrustedCryptomusHost(hostname: string): boolean {
  return hostname === 'cryptomus.com' || hostname.endsWith('.cryptomus.com');
}

/** True when the hostname belongs to any supported payment provider. */
export function isTrustedCheckoutHost(hostname: string): boolean {
  return isTrustedStripeHost(hostname) || isTrustedCryptomusHost(hostname);
}
