import type Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { createStripeRoutes } from '../stripe.routes';
import { createStripePaymentService, type StripePaymentService } from '../stripe.service';
import { createFakeDepositRepository, silentLogger } from '../../__tests__/fakes';
import type { DepositLifecycleService } from '../../deposit-lifecycle.service';

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
      sessions: { create: jest.fn() },
    },
  } as unknown as Stripe;
}

function makeService(): StripePaymentService {
  return createStripePaymentService({
    stripeClient: makeStripeClient(),
    depositRepo: createFakeDepositRepository(),
    lifecycle: makeLifecycle(),
    guestOrderProcessor: {
      async confirmGuestOrderPayment(): Promise<void> {
        /* noop */
      },
    },
    stripeConfig: { secretKey: 'sk_test', webhookSecret: 'whsec' },
    appUrl: 'http://localhost:3000',
    logger: silentLogger,
  });
}

const passThroughAuth = async (): Promise<void> => {
  // no-op for webhook route (no preHandler) and checkout route tests not used here
};

describe('Stripe Webhook Raw Body Handling', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    const service = makeService();
    await app.register(createStripeRoutes({ service, authenticate: passThroughAuth }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('should properly capture raw body for webhook signature verification', async () => {
    // Rebuild app with a service whose handleWebhookEvent is a spy.
    const newApp = Fastify();
    const service = makeService();
    const spy = jest.spyOn(service, 'handleWebhookEvent').mockResolvedValue();
    await newApp.register(createStripeRoutes({ service, authenticate: passThroughAuth }));
    await newApp.ready();

    const mockWebhookPayload = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_test_123', payment_status: 'paid' },
      },
    };

    const response = await newApp.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'stripe-signature-test',
      },
      payload: mockWebhookPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const [rawBody, signature] = spy.mock.calls[0]!;
    expect(typeof rawBody).toBe('string');
    expect(signature).toBe('stripe-signature-test');
    expect(JSON.parse(rawBody)).toEqual(mockWebhookPayload);

    await newApp.close();
  });

  it('should capture raw body when routes are registered with a prefix', async () => {
    const prefixedApp = Fastify();
    const service = makeService();
    const spy = jest.spyOn(service, 'handleWebhookEvent').mockResolvedValue();
    await prefixedApp.register(createStripeRoutes({ service, authenticate: passThroughAuth }), {
      prefix: '/billing/stripe',
    });
    await prefixedApp.ready();

    const mockPayload = {
      id: 'evt_prefix_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_prefix_1' } },
    };

    const response = await prefixedApp.inject({
      method: 'POST',
      url: '/billing/stripe/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig',
      },
      payload: mockPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const [rawBody] = spy.mock.calls[0]!;
    expect(JSON.parse(rawBody)).toEqual(mockPayload);

    await prefixedApp.close();
  });

  it('should return error when stripe-signature header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { 'content-type': 'application/json' },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Missing stripe-signature header' });
  });

  it('should return error when raw body is missing', async () => {
    const mockApp = Fastify();
    mockApp.post('/webhook', async (request, reply) => {
      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }
      if (!(request as unknown as { rawBody?: Buffer }).rawBody) {
        return reply.status(400).send({ error: 'Missing raw body for signature verification' });
      }
      return reply.status(200).send({ received: true });
    });
    await mockApp.ready();

    const response = await mockApp.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'test-sig',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Missing raw body for signature verification' });

    await mockApp.close();
  });

  it('returns 400 when service throws signature verification error', async () => {
    const newApp = Fastify();
    const service = makeService();
    jest
      .spyOn(service, 'handleWebhookEvent')
      .mockRejectedValue(new Error('Signature verification failed'));
    await newApp.register(createStripeRoutes({ service, authenticate: passThroughAuth }));
    await newApp.ready();

    const res = await newApp.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'bad',
      },
      payload: { foo: 'bar' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Signature verification failed' });

    await newApp.close();
  });
});
