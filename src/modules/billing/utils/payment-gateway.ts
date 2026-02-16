export interface PaymentParams {
  amount: number;
  currency: string;
  cryptoCurrency: string;
}

export interface PaymentResult {
  paymentAddress: string;
  cryptoAmount: number;
  expiresAt: Date;
  qrCode: string;
}

export interface PaymentGateway {
  createPayment(params: PaymentParams): Promise<PaymentResult>;
}
