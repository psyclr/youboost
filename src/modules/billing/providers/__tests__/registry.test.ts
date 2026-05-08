import { createPaymentProviderRegistry } from '../registry';
import type { PaymentProvider } from '../types';

function makeProvider(id: 'stripe' | 'cryptomus', configured: boolean): PaymentProvider {
  return {
    id,
    createCheckout: jest.fn(),
    handleWebhook: jest.fn(),
    isConfigured: () => configured,
  };
}

describe('PaymentProvider registry', () => {
  it('returns all providers passed at construction', () => {
    const stripe = makeProvider('stripe', true);
    const cryptomus = makeProvider('cryptomus', true);
    const registry = createPaymentProviderRegistry([stripe, cryptomus]);

    const ids = registry.getAll().map((p) => p.id);
    expect(ids).toEqual(['stripe', 'cryptomus']);
  });

  it('retrieves a provider by id', () => {
    const stripe = makeProvider('stripe', true);
    const cryptomus = makeProvider('cryptomus', false);
    const registry = createPaymentProviderRegistry([stripe, cryptomus]);

    expect(registry.get('stripe')).toBe(stripe);
    expect(registry.get('cryptomus')).toBe(cryptomus);
  });

  it('throws for unknown provider id', () => {
    const registry = createPaymentProviderRegistry([makeProvider('stripe', true)]);
    expect(() => registry.get('cryptomus')).toThrow(/Unknown payment provider/);
  });

  it('isConfigured is delegated to each provider', () => {
    const stripe = makeProvider('stripe', true);
    const cryptomus = makeProvider('cryptomus', false);
    const registry = createPaymentProviderRegistry([stripe, cryptomus]);

    expect(registry.get('stripe').isConfigured()).toBe(true);
    expect(registry.get('cryptomus').isConfigured()).toBe(false);
  });
});
