/**
 * Consumer-side port used by the Stripe webhook handler to notify the
 * owner of a guest-order flow (currently the landings module) that a
 * Stripe Checkout Session completed successfully.
 *
 * The implementation must:
 *   - Guard idempotency (confirm invoked may fire more than once)
 *   - Flip the order from PENDING_PAYMENT to PROCESSING inside a tx
 *   - Emit `order.created` via outbox so downstream handlers fire
 *
 * Billing does NOT import the landings/orders module; landings wires
 * its adapter in the composition root.
 */
export interface GuestOrderProcessorPort {
  confirmGuestOrderPayment(params: {
    orderId: string;
    userId: string;
    stripeSessionId: string;
  }): Promise<void>;
}
