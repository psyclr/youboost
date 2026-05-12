/**
 * Consumer-side ports the landings.checkout flow needs from the
 * auth / orders / billing modules. Wired in the composition root
 * — landings never imports those modules directly.
 */

export interface AutoUserTicketLite {
  userId: string;
  email: string;
  fresh: boolean;
}

export interface AutoUserCreatorPort {
  createAutoUser(email: string): Promise<AutoUserTicketLite>;
}

export interface GuestOrderCreatorPort {
  createPendingPaymentOrder(input: {
    userId: string;
    serviceId: string;
    link: string;
    quantity: number;
    price: number;
  }): Promise<{ orderId: string }>;
  attachStripeSessionId(orderId: string, sessionId: string): Promise<void>;
}

export interface GuestOrderStripePort {
  createGuestOrderSession(input: {
    userId: string;
    orderId: string;
    amount: number;
    productName: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }>;
}
