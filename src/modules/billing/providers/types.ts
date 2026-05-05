export type PaymentProviderId = 'stripe' | 'cryptomus';

export interface CreateCheckoutInput {
  userId: string;
  amount: number;
}

export interface CheckoutResult {
  checkoutId: string;
  url: string;
  depositId: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  handleWebhook(rawBody: string, signature: string): Promise<void>;
  isConfigured(): boolean;
}
