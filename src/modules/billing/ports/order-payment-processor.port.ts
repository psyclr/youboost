/**
 * Consumer-side port used by the PaymentCompletionRouter to settle a Payment
 * once its provider session completes successfully. The owner (the orders
 * module) marks the Payment PAID and submits each of its orders to the SMM
 * provider.
 *
 * The implementation must be idempotent — a completion may fire more than
 * once (provider retries) and a previous run may have partially settled.
 *
 * Billing does NOT import the orders module; the adapter is wired in the
 * composition root.
 */
export interface OrderPaymentProcessorPort {
  confirmOrderPayment(paymentId: string): Promise<void>;
}
