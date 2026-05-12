import type Stripe from 'stripe';
import type { Logger } from 'pino';
import { ValidationError } from '../../../shared/errors';
import type { DepositRepository } from '../deposit.repository';
import type { DepositLifecycleService } from '../deposit-lifecycle.service';
import type { PaymentProvider, CreateCheckoutInput, CheckoutResult } from '../providers/types';
import type { GuestOrderProcessorPort } from '../ports/guest-order-processor.port';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  depositId: string;
}

export interface GuestOrderSessionResponse {
  sessionId: string;
  url: string;
}

export interface GuestOrderSessionInput {
  userId: string;
  orderId: string;
  amount: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripePaymentService {
  readonly provider: PaymentProvider;
  createCheckoutSession(
    userId: string,
    input: { amount: number },
  ): Promise<CheckoutSessionResponse>;
  createGuestOrderSession(input: GuestOrderSessionInput): Promise<GuestOrderSessionResponse>;
  handleWebhookEvent(payload: string, signature: string): Promise<void>;
}

export interface StripePaymentServiceDeps {
  stripeClient: Stripe | null;
  depositRepo: DepositRepository;
  lifecycle: DepositLifecycleService;
  guestOrderProcessor: GuestOrderProcessorPort;
  stripeConfig: { secretKey: string | undefined; webhookSecret: string | undefined };
  appUrl: string;
  logger: Logger;
}

export function createStripePaymentService(deps: StripePaymentServiceDeps): StripePaymentService {
  const {
    stripeClient,
    depositRepo,
    lifecycle,
    guestOrderProcessor,
    stripeConfig,
    appUrl,
    logger,
  } = deps;

  function getStripe(): Stripe {
    if (!stripeClient) {
      throw new ValidationError('Stripe is not configured', 'STRIPE_NOT_CONFIGURED');
    }
    return stripeClient;
  }

  async function createCheckoutSession(
    userId: string,
    input: { amount: number },
  ): Promise<CheckoutSessionResponse> {
    const stripe = getStripe();

    const deposit = await lifecycle.prepareDepositCheckout(userId, input.amount);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'YouBoost Wallet Deposit',
              description: `Add $${input.amount.toFixed(2)} to your YouBoost balance`,
            },
            unit_amount: Math.round(input.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/billing?deposit=success`,
      cancel_url: `${appUrl}/billing/deposit?cancelled=true`,
      metadata: {
        userId,
        depositId: deposit.id,
      },
    });

    await depositRepo.updateDepositStripeSession(deposit.id, session.id);

    logger.info(
      { userId, depositId: deposit.id, sessionId: session.id },
      'Stripe checkout session created',
    );

    if (!session.url) {
      throw new ValidationError(
        'Failed to create checkout session URL',
        'STRIPE_SESSION_URL_ERROR',
      );
    }

    return {
      sessionId: session.id,
      url: session.url,
      depositId: deposit.id,
    };
  }

  async function createGuestOrderSession(
    input: GuestOrderSessionInput,
  ): Promise<GuestOrderSessionResponse> {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: input.productName },
            unit_amount: Math.round(input.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        kind: 'guest-order',
        userId: input.userId,
        orderId: input.orderId,
      },
    });

    if (!session.url) {
      throw new ValidationError(
        'Failed to create checkout session URL',
        'STRIPE_SESSION_URL_ERROR',
      );
    }

    logger.info(
      { orderId: input.orderId, userId: input.userId, sessionId: session.id },
      'Stripe guest-order session created',
    );

    return { sessionId: session.id, url: session.url };
  }

  async function routeCompletedSession(session: {
    id: string;
    metadata?: Stripe.Metadata | null;
  }): Promise<void> {
    const kind = session.metadata?.['kind'];
    const userId = session.metadata?.['userId'];
    if (kind === 'guest-order') {
      const orderId = session.metadata?.['orderId'];
      if (!userId || !orderId) {
        logger.warn(
          { sessionId: session.id },
          'Missing userId/orderId in guest-order Stripe session',
        );
        return;
      }
      await guestOrderProcessor.confirmGuestOrderPayment({
        orderId,
        userId,
        stripeSessionId: session.id,
      });
      return;
    }
    const depositId = session.metadata?.['depositId'];
    if (!userId || !depositId) {
      logger.warn({ sessionId: session.id }, 'Missing metadata in Stripe session');
      return;
    }
    await lifecycle.confirmDepositTransaction(depositId, userId, 'Stripe');
  }

  async function handleWebhookEvent(payload: string, signature: string): Promise<void> {
    const stripe = getStripe();
    if (!stripeConfig.webhookSecret) {
      throw new ValidationError(
        'Stripe webhook secret not configured',
        'STRIPE_WEBHOOK_NOT_CONFIGURED',
      );
    }
    const event = stripe.webhooks.constructEvent(payload, signature, stripeConfig.webhookSecret);
    if (event.type !== 'checkout.session.completed') return;
    await routeCompletedSession(event.data.object);
  }

  const provider: PaymentProvider = {
    id: 'stripe',
    async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
      const res = await createCheckoutSession(input.userId, { amount: input.amount });
      return {
        checkoutId: res.sessionId,
        url: res.url,
        depositId: res.depositId,
      };
    },
    async handleWebhook(rawBody: string, signature: string): Promise<void> {
      await handleWebhookEvent(rawBody, signature);
    },
    isConfigured(): boolean {
      return Boolean(stripeConfig.secretKey) && Boolean(stripeConfig.webhookSecret);
    },
  };

  return { provider, createCheckoutSession, createGuestOrderSession, handleWebhookEvent };
}
