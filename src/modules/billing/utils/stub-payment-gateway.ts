import type { PaymentGateway, PaymentParams, PaymentResult } from './payment-gateway';

const STUB_ADDRESSES: Record<string, string> = {
  USDT: '0xStubUSDTAddress1234567890abcdef',
  BTC: 'bc1qStubBTCAddress1234567890abcdef',
  ETH: '0xStubETHAddress1234567890abcdef00',
};

const STUB_RATES: Record<string, number> = {
  USDT: 1,
  BTC: 0.000015,
  ETH: 0.00035,
};

class StubPaymentGateway implements PaymentGateway {
  async createPayment(params: PaymentParams): Promise<PaymentResult> {
    const rate = STUB_RATES[params.cryptoCurrency] ?? 1;
    const cryptoAmount = params.amount * rate;
    const address = STUB_ADDRESSES[params.cryptoCurrency] ?? '0xDefaultStubAddress';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    return {
      paymentAddress: address,
      cryptoAmount,
      expiresAt,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${address}`,
    };
  }
}

export const paymentGateway: PaymentGateway = new StubPaymentGateway();
