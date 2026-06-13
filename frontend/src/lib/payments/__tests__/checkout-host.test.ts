import {
  isTrustedCheckoutHost,
  isTrustedCryptomusHost,
  isTrustedStripeHost,
} from '../checkout-host';

describe('checkout-host allowlist', () => {
  describe('isTrustedStripeHost', () => {
    it('accepts checkout.stripe.com exactly', () => {
      expect(isTrustedStripeHost('checkout.stripe.com')).toBe(true);
    });

    it('accepts any .stripe.com subdomain', () => {
      expect(isTrustedStripeHost('pay.stripe.com')).toBe(true);
      expect(isTrustedStripeHost('a.b.stripe.com')).toBe(true);
    });

    it('rejects lookalike hosts that merely end with "stripe.com"', () => {
      expect(isTrustedStripeHost('evilstripe.com')).toBe(false);
      expect(isTrustedStripeHost('stripe.com.evil.com')).toBe(false);
    });

    it('rejects the bare apex stripe.com', () => {
      expect(isTrustedStripeHost('stripe.com')).toBe(false);
    });
  });

  describe('isTrustedCryptomusHost', () => {
    it('accepts cryptomus.com exactly', () => {
      expect(isTrustedCryptomusHost('cryptomus.com')).toBe(true);
    });

    it('accepts any .cryptomus.com subdomain', () => {
      expect(isTrustedCryptomusHost('pay.cryptomus.com')).toBe(true);
    });

    it('rejects lookalike hosts that merely end with "cryptomus.com"', () => {
      expect(isTrustedCryptomusHost('evilcryptomus.com')).toBe(false);
      expect(isTrustedCryptomusHost('cryptomus.com.evil.com')).toBe(false);
    });
  });

  describe('isTrustedCheckoutHost', () => {
    it('accepts hosts from either provider', () => {
      expect(isTrustedCheckoutHost('checkout.stripe.com')).toBe(true);
      expect(isTrustedCheckoutHost('pay.cryptomus.com')).toBe(true);
      expect(isTrustedCheckoutHost('cryptomus.com')).toBe(true);
    });

    it('rejects unrelated and empty hosts', () => {
      expect(isTrustedCheckoutHost('example.com')).toBe(false);
      expect(isTrustedCheckoutHost('evilstripe.com')).toBe(false);
      expect(isTrustedCheckoutHost('')).toBe(false);
    });
  });
});
