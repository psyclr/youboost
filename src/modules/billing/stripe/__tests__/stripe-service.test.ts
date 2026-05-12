import type Stripe from 'stripe';
import { createStripePaymentService } from '../stripe.service';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';
import { createFakeDepositRepository, silentLogger } from '../../__tests__/fakes';
import type { GuestOrderProcessorPort } from '../../ports/guest-order-processor.port';

const noopGuestOrderProcessor: GuestOrderProcessorPort = {
  async confirmGuestOrderPayment(): Promise<void> {
    /* noop for deposit-only tests */
  },
};

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

describe('Stripe payment service - webhook handling', () => {
  it('dispatches checkout.session.completed to lifecycle.confirmDepositTransaction', async () => {
    const lifecycle = makeLifecycle();
    const service = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle,
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

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

  it('ignores webhook if metadata is missing', async () => {
    const lifecycle = makeLifecycle();
    const service = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle,
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const event = {
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', metadata: {} } },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('ignores non-checkout-completed events', async () => {
    const lifecycle = makeLifecycle();
    const service = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle,
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    const event = {
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', metadata: { userId: 'u1', depositId: 'd1' } } },
    };

    await service.handleWebhookEvent(JSON.stringify(event), 'sig_fake');

    expect(lifecycle.confirmDepositTransaction).not.toHaveBeenCalled();
  });

  it('throws when stripe is not configured (null client)', async () => {
    const service = createStripePaymentService({
      stripeClient: null,
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: undefined, webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    await expect(service.handleWebhookEvent('{}', 'sig')).rejects.toThrow(/not configured/);
  });

  it('throws when webhook secret is missing', async () => {
    const service = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });

    await expect(service.handleWebhookEvent('{}', 'sig')).rejects.toThrow(
      /webhook secret not configured/,
    );
  });

  it('provider.isConfigured reflects config presence', () => {
    const configured = createStripePaymentService({
      stripeClient: makeStripeClient(),
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });
    expect(configured.provider.isConfigured()).toBe(true);

    const unconfigured = createStripePaymentService({
      stripeClient: null,
      depositRepo: createFakeDepositRepository(),
      lifecycle: makeLifecycle(),
      guestOrderProcessor: noopGuestOrderProcessor,
      stripeConfig: { secretKey: undefined, webhookSecret: undefined },
      appUrl: 'http://localhost:3000',
      logger: silentLogger,
    });
    expect(unconfigured.provider.isConfigured()).toBe(false);
  });
});
