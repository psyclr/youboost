jest.mock('../../../../shared/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    stripe: { secretKey: 'sk_test', webhookSecret: 'whsec' },
    cryptomus: { merchantId: 'm', paymentKey: 'k', callbackUrl: 'https://x' },
    app: { url: 'http://localhost:3000' },
    billing: { minDeposit: 5, maxDeposit: 10_000, depositExpiryMs: 3_600_000 },
  }),
}));

jest.mock('../../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: jest.fn() },
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  })),
);

import { getPaymentProviders, getPaymentProvider } from '../registry';

describe('PaymentProvider registry', () => {
  it('returns both stripe and cryptomus providers', () => {
    const providers = getPaymentProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('stripe');
    expect(ids).toContain('cryptomus');
  });

  it('retrieves a provider by id', () => {
    const stripe = getPaymentProvider('stripe');
    expect(stripe.id).toBe('stripe');

    const cryptomus = getPaymentProvider('cryptomus');
    expect(cryptomus.id).toBe('cryptomus');
  });

  it('reports configured state from env', () => {
    const stripe = getPaymentProvider('stripe');
    const cryptomus = getPaymentProvider('cryptomus');
    expect(stripe.isConfigured()).toBe(true);
    expect(cryptomus.isConfigured()).toBe(true);
  });

  it('each provider implements PaymentProvider interface', () => {
    const providers = getPaymentProviders();
    for (const p of providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.createCheckout).toBe('function');
      expect(typeof p.handleWebhook).toBe('function');
      expect(typeof p.isConfigured).toBe('function');
    }
  });
});
