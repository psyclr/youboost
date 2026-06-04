import type { Logger } from 'pino';
import type { PrismaClient } from '../../generated/prisma';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type { OutboxPort } from '../../shared/outbox/outbox.port';
import type { LandingRepository } from './landing.repository';
import type { ServiceLookupPort } from './ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderPaymentPort,
} from './ports/guest-checkout.ports';
import type {
  LandingCartCheckoutInput,
  LandingCartCheckoutResult,
  LandingTierRecord,
} from './landing.types';

export interface GuestCartCheckoutFlowDeps {
  prisma: PrismaClient;
  landingRepo: LandingRepository;
  serviceLookup: ServiceLookupPort;
  autoUserCreator: AutoUserCreatorPort;
  orderCreator: GuestOrderCreatorPort;
  payments: GuestOrderPaymentPort;
  outbox: OutboxPort;
  appUrl: string;
  logger: Logger;
}

interface PricedItem {
  serviceId: string;
  link: string;
  quantity: number;
  price: number;
}

/**
 * Validate one cart item against its landing tier + service bounds and compute
 * its price. Throws a coded ValidationError (with the code embedded in the
 * message) so the caller can surface a per-item error.
 */
async function priceCartItem(args: {
  serviceLookup: ServiceLookupPort;
  tiers: LandingTierRecord[];
  item: { tierId: string; link: string; quantity: number };
  index: number;
}): Promise<PricedItem> {
  const { serviceLookup, tiers, item, index } = args;
  const tier = tiers.find((t) => t.id === item.tierId);
  if (!tier) {
    throw new ValidationError(
      `Tier does not belong to landing (item ${index}) (LANDING_TIER_MISMATCH)`,
      'LANDING_TIER_MISMATCH',
    );
  }
  const service = await serviceLookup.getService(tier.serviceId);
  if (item.quantity < service.minQuantity) {
    throw new ValidationError(
      `Quantity below min ${service.minQuantity} (item ${index}) (QUANTITY_BELOW_MIN)`,
      'QUANTITY_BELOW_MIN',
    );
  }
  if (item.quantity > service.maxQuantity) {
    throw new ValidationError(
      `Quantity above max ${service.maxQuantity} (item ${index}) (QUANTITY_ABOVE_MAX)`,
      'QUANTITY_ABOVE_MAX',
    );
  }
  const pricePer1000 =
    tier.priceOverride !== null ? Number(tier.priceOverride) : service.pricePer1000;
  const price = Math.round(((pricePer1000 * item.quantity) / 1000) * 100) / 100;
  return { serviceId: tier.serviceId, link: item.link, quantity: item.quantity, price };
}

/**
 * Guest cart checkout: validate each item against the landing's tiers and the
 * service min/max, sum the total, create one Payment with N PENDING_PAYMENT
 * orders, open a provider session encoding an order-payment reference, and
 * attach the session to the Payment. On payment success the webhook routes to
 * `confirmOrderPayment`, which submits each order to its SMM provider.
 */
export async function executeGuestCartCheckout(
  deps: GuestCartCheckoutFlowDeps,
  slug: string,
  input: LandingCartCheckoutInput,
): Promise<LandingCartCheckoutResult> {
  const {
    prisma,
    landingRepo,
    serviceLookup,
    autoUserCreator,
    orderCreator,
    payments,
    outbox,
    appUrl,
    logger,
  } = deps;

  const landing = await landingRepo.findBySlug(slug);
  if (!landing || landing.status !== 'PUBLISHED') {
    throw new NotFoundError('Landing not found (LANDING_NOT_FOUND)', 'LANDING_NOT_FOUND');
  }

  const priced: PricedItem[] = [];
  let index = -1;
  for (const item of input.items) {
    index += 1;
    priced.push(await priceCartItem({ serviceLookup, tiers: landing.tiers, item, index }));
  }

  const total = Math.round(priced.reduce((sum, p) => sum + p.price, 0) * 100) / 100;
  const provider = input.paymentProvider === 'cryptomus' ? 'CRYPTOMUS' : 'STRIPE';

  const ticket = await autoUserCreator.createAutoUser(input.email);
  const { paymentId, orderIds } = await orderCreator.createPaymentWithOrders({
    userId: ticket.userId,
    provider,
    amount: total,
    items: priced,
  });

  const session = await payments.createPaymentSession({
    provider: input.paymentProvider,
    amount: total,
    productName: priced.length === 1 ? '1 service' : `${priced.length} services`,
    reference: { kind: 'order-payment', paymentId, userId: ticket.userId },
    successUrl: `${appUrl}/checkout/success?payment=${paymentId}`,
    cancelUrl: `${appUrl}/lp/${landing.slug}?checkout=cancelled`,
  });
  await orderCreator.attachPaymentSession(paymentId, session.sessionId);

  const firstTierId = input.items[0]?.tierId ?? '';
  await prisma.$transaction(async (tx) => {
    await outbox.emit(
      {
        type: 'landing.guest_checkout_started',
        aggregateType: 'landing',
        aggregateId: landing.id,
        userId: ticket.userId,
        payload: {
          landingId: landing.id,
          tierId: firstTierId,
          paymentProvider: input.paymentProvider,
          orderIds,
          userId: ticket.userId,
          email: ticket.email,
        },
      },
      tx,
    );
  });

  logger.info(
    {
      landingId: landing.id,
      paymentId,
      orderCount: orderIds.length,
      userId: ticket.userId,
      fresh: ticket.fresh,
    },
    'Guest cart checkout session opened',
  );

  return { userId: ticket.userId, paymentId, orderIds, checkoutUrl: session.url };
}
