import Stripe from 'stripe';
import { ValidationError } from '../../../shared/errors';
import { createServiceLogger } from '../../../shared/utils/logger';
import { getConfig } from '../../../shared/config';
import * as walletRepo from '../wallet.repository';
import * as ledgerRepo from '../ledger.repository';
import * as depositRepo from '../deposit.repository';

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

export interface CreateCheckoutInput {
  amount: number; // USD amount
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export async function createCheckoutSession(
  userId: string,
  input: CreateCheckoutInput,
): Promise<CheckoutSessionResponse> {
  const stripe = getStripe();
  const config = getConfig();

  if (input.amount < 5) {
    throw new ValidationError('Minimum deposit is $5.00', 'MIN_DEPOSIT');
  }
  if (input.amount > 10_000) {
    throw new ValidationError('Maximum deposit is $10,000.00', 'MAX_DEPOSIT');
  }

  await walletRepo.getOrCreateWallet(userId);

  const deposit = await depositRepo.createDeposit({
    userId,
    amount: input.amount,
    cryptoAmount: 0,
    cryptoCurrency: '',
    paymentAddress: '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

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
          unit_amount: Math.round(input.amount * 100), // cents
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

  // Update deposit with stripe session ID
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
    await handleCheckoutCompleted(session);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.['userId'];
  const depositId = session.metadata?.['depositId'];

  if (!userId || !depositId) {
    log.warn({ sessionId: session.id }, 'Missing metadata in Stripe session');
    return;
  }

  const deposit = await depositRepo.findDepositById(depositId, userId);
  if (!deposit) {
    log.warn({ depositId, userId }, 'Deposit not found for Stripe session');
    return;
  }

  if (deposit.status !== 'PENDING') {
    log.debug({ depositId, status: deposit.status }, 'Deposit already processed');
    return;
  }

  const amount = Number(deposit.amount);
  const wallet = await walletRepo.getOrCreateWallet(userId);
  const balanceBefore = Number(wallet.balance);
  const newBalance = balanceBefore + amount;

  await walletRepo.updateBalance({
    walletId: wallet.id,
    newBalance,
    newHold: Number(wallet.holdAmount),
  });

  const entry = await ledgerRepo.createLedgerEntry({
    userId,
    walletId: wallet.id,
    type: 'DEPOSIT',
    amount,
    balanceBefore,
    balanceAfter: newBalance,
    referenceType: 'deposit',
    referenceId: depositId,
    description: `Stripe deposit $${amount.toFixed(2)}`,
  });

  await depositRepo.updateDepositStatus(depositId, {
    status: 'CONFIRMED',
    confirmedAt: new Date(),
    ledgerEntryId: entry.id,
  });

  log.info({ userId, depositId, amount }, 'Stripe deposit confirmed');
}
