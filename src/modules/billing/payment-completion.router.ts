import type { PaymentReference } from './payment-reference';

export interface PaymentCompletionHandlers {
  confirmDeposit(depositId: string, userId: string): Promise<void>;
  confirmOrderPayment(paymentId: string): Promise<void>;
}

export interface PaymentCompletionRouter {
  handle(ref: PaymentReference | null): Promise<void>;
}

export function createPaymentCompletionRouter(
  handlers: PaymentCompletionHandlers,
): PaymentCompletionRouter {
  return {
    async handle(ref): Promise<void> {
      if (!ref) return;
      if (ref.kind === 'deposit') {
        await handlers.confirmDeposit(ref.depositId, ref.userId);
        return;
      }
      await handlers.confirmOrderPayment(ref.paymentId);
    },
  };
}
