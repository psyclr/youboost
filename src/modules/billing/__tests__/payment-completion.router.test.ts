import { createPaymentCompletionRouter } from '../payment-completion.router';

describe('PaymentCompletionRouter', () => {
  const calls: string[] = [];
  const router = createPaymentCompletionRouter({
    confirmDeposit: async (depositId, userId) => {
      calls.push(`dep:${depositId}:${userId}`);
    },
    confirmOrderPayment: async (paymentId) => {
      calls.push(`pay:${paymentId}`);
    },
  });
  beforeEach(() => {
    calls.length = 0;
  });

  it('routes deposit references to confirmDeposit', async () => {
    await router.handle({ kind: 'deposit', depositId: 'd1', userId: 'u1' });
    expect(calls).toEqual(['dep:d1:u1']);
  });
  it('routes order-payment references to confirmOrderPayment', async () => {
    await router.handle({ kind: 'order-payment', paymentId: 'p1', userId: 'u1' });
    expect(calls).toEqual(['pay:p1']);
  });
  it('ignores a null reference (unknown session)', async () => {
    await router.handle(null);
    expect(calls).toEqual([]);
  });
});
