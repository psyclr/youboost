/**
 * Consumer-side ports the landings.checkout flow needs from the
 * auth / orders / billing modules. Wired in the composition root
 * — landings never imports those modules directly.
 */

import type { PaymentReference } from '../../billing/payment-reference';

export interface AutoUserTicketLite {
  userId: string;
  email: string;
  fresh: boolean;
}

export interface AutoUserCreatorPort {
  createAutoUser(email: string): Promise<AutoUserTicketLite>;
}

export interface GuestOrderCreatorPort {
  /**
   * Create one Payment and N PENDING_PAYMENT orders linked to it, in a single transaction.
   */
  createPaymentWithOrders(input: {
    userId: string;
    provider: 'STRIPE' | 'CRYPTOMUS';
    amount: number;
    items: { serviceId: string; link: string; quantity: number; price: number }[];
    metrikaClientId?: string | null;
  }): Promise<{ paymentId: string; orderIds: string[] }>;
  /** Attach the provider session id to the Payment. */
  attachPaymentSession(paymentId: string, providerSessionId: string): Promise<void>;
}

export type GuestPaymentProvider = 'stripe' | 'cryptomus';

export interface GuestOrderPaymentPort {
  /**
   * Create a provider checkout session for a Payment, encoding a PaymentReference
   * so the completion webhook can route back to `confirmOrderPayment`.
   */
  createPaymentSession(input: {
    provider: GuestPaymentProvider;
    amount: number;
    productName: string;
    reference: PaymentReference;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }>;
}
