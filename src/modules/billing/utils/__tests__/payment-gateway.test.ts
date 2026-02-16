import { paymentGateway } from '../stub-payment-gateway';

describe('StubPaymentGateway', () => {
  it('should return a payment result for USDT', async () => {
    const result = await paymentGateway.createPayment({
      amount: 100,
      currency: 'USD',
      cryptoCurrency: 'USDT',
    });

    expect(result.paymentAddress).toContain('USDT');
    expect(result.cryptoAmount).toBe(100);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.qrCode).toContain('http');
  });

  it('should return a payment result for BTC', async () => {
    const result = await paymentGateway.createPayment({
      amount: 100,
      currency: 'USD',
      cryptoCurrency: 'BTC',
    });

    expect(result.paymentAddress).toContain('BTC');
    expect(result.cryptoAmount).toBe(100 * 0.000015);
  });

  it('should return a payment result for ETH', async () => {
    const result = await paymentGateway.createPayment({
      amount: 100,
      currency: 'USD',
      cryptoCurrency: 'ETH',
    });

    expect(result.paymentAddress).toContain('ETH');
    expect(result.cryptoAmount).toBe(100 * 0.00035);
  });

  it('should set expiry to approximately 30 minutes in the future', async () => {
    const before = Date.now();
    const result = await paymentGateway.createPayment({
      amount: 50,
      currency: 'USD',
      cryptoCurrency: 'USDT',
    });
    const after = Date.now();

    const thirtyMinMs = 30 * 60 * 1000;
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyMinMs - 100);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyMinMs + 100);
  });

  it('should use default address for unknown crypto', async () => {
    const result = await paymentGateway.createPayment({
      amount: 10,
      currency: 'USD',
      cryptoCurrency: 'DOGE',
    });

    expect(result.paymentAddress).toBe('0xDefaultStubAddress');
    expect(result.cryptoAmount).toBe(10);
  });
});
