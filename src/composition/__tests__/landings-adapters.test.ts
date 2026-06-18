import {
  selectGuestPaymentPort,
  createFakeGuestPaymentPort,
} from '../landings-adapters';
import type { StripePaymentService } from '../../modules/billing';
import type { CryptomusPaymentService } from '../../modules/billing';
import type { PaymentReference } from '../../modules/billing/payment-reference';

const sessionInput = (provider: 'stripe' | 'cryptomus'): Parameters<
  ReturnType<typeof createFakeGuestPaymentPort>['createPaymentSession']
>[0] => ({
  provider,
  amount: 2,
  productName: '1 service',
  reference: { kind: 'order-payment', paymentId: 'pay-1', userId: 'user-1' } as PaymentReference,
  successUrl: 'https://www.youboost.store/checkout/success',
  cancelUrl: 'https://www.youboost.store/lp/x',
});

describe('selectGuestPaymentPort', () => {
  // Sentinels: if select() routes to the real port, calling these throws, so the
  // test would fail loudly rather than silently hitting a provider.
  const realStripe = {
    createPaymentSession: () => {
      throw new Error('real stripe must not be called when PAYMENTS_FAKE is on');
    },
  } as unknown as StripePaymentService;
  const realCryptomus = {
    createPaymentSession: () => {
      throw new Error('real cryptomus must not be called when PAYMENTS_FAKE is on');
    },
  } as unknown as CryptomusPaymentService;

  it('returns the real composed port when fake=false', () => {
    const port = selectGuestPaymentPort(false, realStripe, realCryptomus);
    // Routing to the real (throwing) sentinel proves we did NOT pick the fake.
    expect(() => port.createPaymentSession(sessionInput('stripe'))).toThrow('real stripe');
  });

  it('returns the fake port when fake=true (no real provider call)', async () => {
    const port = selectGuestPaymentPort(true, realStripe, realCryptomus);
    const res = await port.createPaymentSession(sessionInput('cryptomus'));
    expect(res.sessionId).toMatch(/^fake-/);
  });
});

describe('createFakeGuestPaymentPort', () => {
  it('returns a checkout URL on the provider trusted host so the frontend allowlist passes', async () => {
    const port = createFakeGuestPaymentPort();

    const crypto = await port.createPaymentSession(sessionInput('cryptomus'));
    expect(new URL(crypto.url).hostname).toBe('pay.cryptomus.com');

    const stripe = await port.createPaymentSession(sessionInput('stripe'));
    expect(new URL(stripe.url).hostname).toBe('checkout.stripe.com');
  });
});
