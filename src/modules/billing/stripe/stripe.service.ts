import Stripe from 'stripe';
import { ValidationError } from '../../../shared/errors';
import { createServiceLogger } from '../../../shared/utils/logger';
import { getConfig } from '../../../shared/config';
import * as depositRepo from '../deposit.repository';
import { prepareDepositCheckout, confirmDepositTransaction } from '../deposit-lifecycle.service';
import type { PaymentProvider, CreateCheckoutInput, CheckoutResult } from '../providers/types';

const log = createServiceLogger('stripe');

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const config = getConfig();
  if (!config.stripe.secretKey) {
    throw new ValidationError('Stripe is not configured', 'STRIPE_NOT_CONFIGURED');
  }
  stripeClient = new Stripe(config.stripe.secretKey);
  return stripeClient;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  depositId: string;
}

export async function createCheckoutSession(
  userId: string,
  input: { amount: number },
): Promise<CheckoutSessionResponse> {
  const stripe = getStripe();
  const config = getConfig();

  const deposit = await prepareDepositCheckout(userId, input.amount);

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
    success_url: `${config.app.url}/billing?deposit=success`,
    cancel_url: `${config.app.url}/billing/deposit?cancelled=true`,
    metadata: {
      userId,
      depositId: deposit.id,
    },
  });

  await depositRepo.updateDepositStripeSession(deposit.id, session.id);

  log.info(
    { userId, depositId: deposit.id, sessionId: session.id },
    'Stripe checkout session created',
  );

  if (!session.url) {
    throw new ValidationError('Failed to create checkout session URL', 'STRIPE_SESSION_URL_ERROR');
  }

  return {
    sessionId: session.id,
    url: session.url,
    depositId: deposit.id,
  };
}

export async function handleWebhookEvent(payload: string, signature: string): Promise<void> {
  const stripe = getStripe();
  const config = getConfig();

  if (!config.stripe.webhookSecret) {
    throw new ValidationError(
      'Stripe webhook secret not configured',
      'STRIPE_WEBHOOK_NOT_CONFIGURED',
    );
  }

  const event = stripe.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.['userId'];
    const depositId = session.metadata?.['depositId'];

    if (!userId || !depositId) {
      log.warn({ sessionId: session.id }, 'Missing metadata in Stripe session');
      return;
    }

    await confirmDepositTransaction(depositId, userId, 'Stripe');
  }
}

export const stripeProvider: PaymentProvider = {
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
    const { stripe } = getConfig();
    return Boolean(stripe.secretKey) && Boolean(stripe.webhookSecret);
  },
};
