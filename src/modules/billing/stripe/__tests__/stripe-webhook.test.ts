import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { stripeRoutes } from '../stripe.routes';
import * as stripeService from '../stripe.service';

// Mock the stripe service
jest.mock('../stripe.service');

describe('Stripe Webhook Raw Body Handling', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(stripeRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('should properly capture raw body for webhook signature verification', async () => {
    const mockWebhookPayload = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
        },
      },
    };

    const mockSignature = 'stripe-signature-test';
    const mockHandleWebhookEvent = jest
      .spyOn(stripeService, 'handleWebhookEvent')
      .mockResolvedValue();

    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': mockSignature,
      },
      payload: mockWebhookPayload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });

    // Verify that handleWebhookEvent was called with the raw body string
    expect(mockHandleWebhookEvent).toHaveBeenCalledTimes(1);
    const [rawBody, signature] = mockHandleWebhookEvent.mock.calls[0]!;
    expect(typeof rawBody).toBe('string');
    expect(signature).toBe(mockSignature);

    // The raw body should be the exact JSON string representation
    expect(JSON.parse(rawBody)).toEqual(mockWebhookPayload);
  });

  it('should capture raw body when routes are registered with a prefix', async () => {
    // Regression test: production registers stripeRoutes with prefix '/billing/stripe'.
    // Previously the content-type parser branched on req.url === '/webhook',
    // which was never true in production (req.url is '/billing/stripe/webhook').
    const prefixedApp = Fastify();
    await prefixedApp.register(stripeRoutes, { prefix: '/billing/stripe' });
    await prefixedApp.ready();

    const mockPayload = {
      id: 'evt_prefix_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_prefix_1' } },
    };
    const mockHandleWebhookEvent = jest
      .spyOn(stripeService, 'handleWebhookEvent')
      .mockResolvedValue();

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
    expect(mockHandleWebhookEvent).toHaveBeenCalledTimes(1);
    const [rawBody] = mockHandleWebhookEvent.mock.calls[0]!;
    expect(JSON.parse(rawBody)).toEqual(mockPayload);

    await prefixedApp.close();
  });

  it('should return error when stripe-signature header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Missing stripe-signature header' });
  });

  it('should return error when raw body is missing', async () => {
    // This shouldn't happen in practice, but let's test the edge case
    const mockApp = Fastify();

    // Register routes without the content type parser
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
});
