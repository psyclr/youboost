import type Stripe from 'stripe';
import { createStripePaymentService } from '../stripe.service';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';
import { createFakeDepositRepository, silentLogger } from '../../__tests__/fakes';
import { createPaymentCompletionRouter } from '../../payment-completion.router';

function makeLifecycle(): jest.Mocked<DepositLifecycleService> {
  return {
    prepareDepositCheckout: jest.fn(),
    confirmDepositTransaction: jest.fn(),
    failDepositTransaction: jest.fn(),
  };
}

function makeStripeClient(): Stripe {
  return {
    webhooks: {
      constructEvent: jest.fn((payload: string) => JSON.parse(payload)),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  } as unknown as Stripe;
}

function makeService(
  lifecycle: jest.Mocked<DepositLifecycleService>,
  confirmOrderPayment?: jest.Mock,
) {
  const completionRouter = createPaymentCompletionRouter({
    confirmDeposit: (depositId, userId) =>
      lifecycle.confirmDepositTransaction(depositId, userId, 'Stripe'),
    confirmOrderPayment: confirmOrderPayment ?? jest.fn(),
  });
  return createStripePaymentService({
    stripeClient: makeStripeClient(),
    depositRepo: createFakeDepositRepository(),
    lifecycle,
    completionRouter,
    stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
    appUrl: 'http://localhost:3000',
    logger: silentLogger,
  });
}

describe('Stripe payment service - webhook handling', () => {
  it('dispatches checkout.session.completed to lifecycle.confirmDepositTransaction', async () => {
    const lifecycle = makeLifecycle();
    const service = makeService(lifecycle);

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          metadata: { userId: 'user-1', depositId: 'dep-1' },
        },
      },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(lifecycle.confirmDepositTransaction).toHaveBeenCalledWith('dep-1', 'user-1', 'Stripe');
  });

  it('routes order-payment session to confirmOrderPayment', async () => {
    const lifecycle = makeLifecycle();
    const confirmOrderPayment = jest.fn().mockResolvedValue(undefined);
    const service = makeService(lifecycle, confirmOrderPayment);

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_pay_1',
          metadata: { kind: 'order-payment', paymentId: 'pay-1', userId: 'user-1' },
        },
      },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(confirmOrderPayment).toHaveBeenCalledWith('pay-1');
    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores webhook if metadata is missing', async () => {
    const lifecycle = makeLifecycle();
    const service = makeService(lifecycle);

    const event = {
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', metadata: {} } },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores non-checkout-completed events', async () => {
    const lifecycle = makeLifecycle();
    const service = makeService(lifecycle);

    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', metadata: { userId: 'u1', depositId: 'd1' } } },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('throws a public-safe error when card payments are not configured', async () => {
    const completionRouter = createPaymentCompletionRouter({
      confirmDeposit: jest.fn(),
      confirmOrderPayment: jest.fn(),
    });
    const service = createStripePaymentService({
      stripeClient: null,
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      completionRouter,
      stripeConfig: { secretKey: undefined, webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    await expect(service.handleWebhookEvent('{}', 'sig')).rejects.toMatchObject({
      code: 'STRIPE_NOT_CONFIGURED',
      message:
        'Card payments are temporarily unavailable. Please try another payment method or contact support.',
    });
  });

  it('throws when webhook secret is missing', async () => {
    const completionRouter = createPaymentCompletionRouter({
      confirmDeposit: jest.fn(),
      confirmOrderPayment: jest.fn(),
    });
    const service = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      completionRouter,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    await expect(service.handleWebhookEvent('{}', 'sig')).rejects.toThrow(
      /webhook secret not configured/,
    );
  });

  it('provider.isConfigured reflects config presence', () => {
    const completionRouter = createPaymentCompletionRouter({
      confirmDeposit: jest.fn(),
      confirmOrderPayment: jest.fn(),
    });

    const configured = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      completionRouter,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });
    expect(configured.provider.isConfigured()).toBe(true);

    const unconfigured = createStripePaymentService({
      stripeClient: null,
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      completionRouter,
      stripeConfig: { secretKey: undefined, webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });
    expect(unconfigured.provider.isConfigured()).toBe(false);
  });
});
