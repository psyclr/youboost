import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox/outbox.port';
import type { LandingRepository } from './landing.repository';
import type { ServiceLookupPort } from './ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderStripePort,
} from './ports/guest-checkout.ports';
import type { LandingCheckoutInput, LandingCheckoutResult } from './landing.types';

export interface GuestCheckoutFlowDeps {
  prisma: PrismaClient;
  landingRepo: LandingRepository;
  serviceLookup: ServiceLookupPort;
  autoUserCreator: AutoUserCreatorPort;
  orderCreator: GuestOrderCreatorPort;
  stripe: GuestOrderStripePort;
  outbox: OutboxPort;
  appUrl: string;
  logger: Logger;
}

export async function executeGuestCheckout(
  deps: GuestCheckoutFlowDeps,
  slug: string,
  input: LandingCheckoutInput,
): Promise<LandingCheckoutResult> {
  const {
    prisma,
    landingRepo,
    serviceLookup,
    autoUserCreator,
    orderCreator,
    stripe,
    outbox,
    appUrl,
    logger,
  } = deps;

  const landing = await landingRepo.findBySlug(slug);
  if (!landing || landing.status !== 'PUBLISHED') {
    throw new NotFoundError('Landing not found', 'LANDING_NOT_FOUND');
  }
  const tier = landing.tiers.find((t) => t.id === input.tierId);
  if (!tier) {
    throw new ValidationError('Tier does not belong to landing', 'LANDING_TIER_MISMATCH');
  }

  const service = await serviceLookup.getService(tier.serviceId);
  if (input.quantity < service.minQuantity) {
    throw new ValidationError(`Quantity below min ${service.minQuantity}`, 'QUANTITY_BELOW_MIN');
  }
  if (input.quantity > service.maxQuantity) {
    throw new ValidationError(`Quantity above max ${service.maxQuantity}`, 'QUANTITY_ABOVE_MAX');
  }

  const price = Math.round(((service.pricePer1000 * input.quantity) / 1000) * 100) / 100;

  const ticket = await autoUserCreator.createAutoUser(input.email);
  const { orderId } = await orderCreator.createPendingPaymentOrder({
    userId: ticket.userId,
    serviceId: tier.serviceId,
    link: input.link,
    quantity: input.quantity,
    price,
  });

  const session = await stripe.createGuestOrderSession({
    userId: ticket.userId,
    orderId,
    amount: price,
    productName: tier.titleOverride ?? service.name,
    successUrl: `${appUrl}/checkout/success?order=${orderId}`,
    cancelUrl: `${appUrl}/lp/${landing.slug}?checkout=cancelled`,
  });
  await orderCreator.attachStripeSessionId(orderId, session.sessionId);

  await prisma.$transaction(async (tx) => {
    await outbox.emit(
      {
        type: 'landing.guest_checkout_started',
        aggregateType: 'landing',
        aggregateId: landing.id,
        userId: ticket.userId,
        payload: {
          landingId: landing.id,
          tierId: tier.id,
          orderId,
          userId: ticket.userId,
          email: ticket.email,
        },
      },
      tx,
    );
  });

  logger.info(
    { landingId: landing.id, tierId: tier.id, orderId, userId: ticket.userId, fresh: ticket.fresh },
    'Guest checkout session opened',
  );

  return { orderId, userId: ticket.userId, checkoutUrl: session.url };
}
