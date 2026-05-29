import {
  executeGuestCartCheckout,
  type GuestCartCheckoutFlowDeps,
} from '../guest-cart-checkout.flow';
import type { Prisma, PrismaClient } from '../../../generated/prisma';
import type { OutboxEvent, OutboxPort } from '../../../shared/outbox';
import type { LandingRepository, LandingRecord } from '../landing.repository';
import type { ServiceLookupPort, ServiceLookupRecord } from '../ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderPaymentPort,
} from '../ports/guest-checkout.ports';
import { silentLogger } from './fakes';

function fakePrisma(): PrismaClient {
  const tx = {} as Prisma.TransactionClient;
  return {
    $transaction: async <T>(cb: (t: Prisma.TransactionClient) => Promise<T>): Promise<T> => cb(tx),
  } as unknown as PrismaClient;
}

function makeTier(
  id: string,
  serviceId: string,
  priceOverride: string | null,
): LandingRecord['tiers'][number] {
  return {
    id,
    serviceId,
    order: 0,
    pillKind: null,
    glowKind: null,
    titleOverride: null,
    descOverride: null,
    priceOverride,
    unit: '1k',
    service: {
      id: serviceId,
      name: `Service ${serviceId}`,
      description: null,
      platform: 'YOUTUBE',
      type: 'VIEWS',
      pricePer1000: '2.00',
      minQuantity: 100,
      maxQuantity: 1_000_000,
      refillDays: null,
      isActive: true,
    },
  };
}

function makeLanding(): LandingRecord {
  return {
    id: 'landing-1',
    slug: 'slug',
    status: 'PUBLISHED',
    seoTitle: 't',
    seoDescription: 'd',
    seoOgImageUrl: null,
    heroEyebrow: null,
    heroTitle: 'h',
    heroAccent: null,
    heroLead: 'l',
    heroPlaceholder: 'p',
    heroCtaLabel: 'GO!',
    heroFineprint: null,
    heroMinAmount: '4',
    defaultServiceId: null,
    stats: [],
    steps: [],
    faq: [],
    footerCta: null,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    tiers: [makeTier('t1', 's1', '2.00'), makeTier('t2', 's2', '3.00')],
  };
}

interface CartDeps extends GuestCartCheckoutFlowDeps {
  orderCreator: GuestOrderCreatorPort & {
    createPaymentWithOrders: jest.Mock;
    attachPaymentSession: jest.Mock;
  };
  payments: GuestOrderPaymentPort & { createPaymentSession: jest.Mock };
  outboxEvents: OutboxEvent[];
}

function makeCartDeps(landing: LandingRecord = makeLanding()): CartDeps {
  const landingRepo = {
    async findBySlug(slug: string): Promise<LandingRecord | null> {
      return slug === landing.slug ? landing : null;
    },
  } as unknown as LandingRepository;

  const serviceLookup: ServiceLookupPort = {
    async getService(serviceId): Promise<ServiceLookupRecord> {
      return {
        id: serviceId,
        name: `Service ${serviceId}`,
        pricePer1000: 2,
        minQuantity: 100,
        maxQuantity: 1_000_000,
      };
    },
  };

  const autoUserCreator: AutoUserCreatorPort = {
    async createAutoUser(email): Promise<{ userId: string; email: string; fresh: boolean }> {
      return { userId: `user-${email}`, email, fresh: true };
    },
  };

  const createPaymentWithOrders = jest.fn(async () => ({
    paymentId: 'pay1',
    orderIds: ['o1', 'o2'],
  }));
  const attachPaymentSession = jest.fn(async () => undefined);
  const orderCreator = {
    createPaymentWithOrders,
    attachPaymentSession,
  } as unknown as CartDeps['orderCreator'];

  const createPaymentSession = jest.fn(async () => ({
    sessionId: 'sess_1',
    url: 'https://pay.test/sess_1',
  }));
  const payments = {
    createPaymentSession,
  } as unknown as CartDeps['payments'];

  const outboxEvents: OutboxEvent[] = [];
  const outbox: OutboxPort = {
    async emit(event): Promise<void> {
      outboxEvents.push(event);
    },
  };

  return {
    prisma: fakePrisma(),
    landingRepo,
    serviceLookup,
    autoUserCreator,
    orderCreator,
    payments,
    outbox,
    appUrl: 'http://app.test',
    logger: silentLogger,
    outboxEvents,
  };
}

describe('executeGuestCartCheckout', () => {
  it('creates one payment for the summed total + N orders and a session', async () => {
    const deps = makeCartDeps();
    const res = await executeGuestCartCheckout(deps, 'slug', {
      email: 'a@b.com',
      items: [
        { tierId: 't1', link: 'https://x/1', quantity: 1000 }, // $2.00
        { tierId: 't2', link: 'https://x/2', quantity: 1000 }, // $3.00
      ],
      paymentProvider: 'stripe',
    });

    expect(deps.orderCreator.createPaymentWithOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'STRIPE',
        amount: 5,
        items: expect.arrayContaining([
          expect.objectContaining({ price: 2 }),
          expect.objectContaining({ price: 3 }),
        ]),
      }),
    );
    expect(deps.payments.createPaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5,
        reference: expect.objectContaining({ kind: 'order-payment', paymentId: 'pay1' }),
      }),
    );
    expect(deps.orderCreator.attachPaymentSession).toHaveBeenCalledWith('pay1', 'sess_1');
    expect(res).toEqual(
      expect.objectContaining({
        paymentId: 'pay1',
        orderIds: ['o1', 'o2'],
        checkoutUrl: 'https://pay.test/sess_1',
      }),
    );
    expect(deps.outboxEvents.some((e) => e.type === 'landing.guest_checkout_started')).toBe(true);
  });

  it('rejects an item whose tier is not on the landing', async () => {
    const deps = makeCartDeps();
    await expect(
      executeGuestCartCheckout(deps, 'slug', {
        email: 'a@b.com',
        items: [{ tierId: 'NOPE', link: 'l', quantity: 1000 }],
        paymentProvider: 'stripe',
      }),
    ).rejects.toThrow(/LANDING_TIER_MISMATCH/);
  });

  it('rejects quantity below the service minimum (with item index)', async () => {
    const deps = makeCartDeps();
    await expect(
      executeGuestCartCheckout(deps, 'slug', {
        email: 'a@b.com',
        items: [{ tierId: 't1', link: 'l', quantity: 1 }],
        paymentProvider: 'stripe',
      }),
    ).rejects.toThrow(/QUANTITY_BELOW_MIN/);
  });

  it('throws when the landing is not found', async () => {
    const deps = makeCartDeps();
    await expect(
      executeGuestCartCheckout(deps, 'missing', {
        email: 'a@b.com',
        items: [{ tierId: 't1', link: 'l', quantity: 1000 }],
        paymentProvider: 'stripe',
      }),
    ).rejects.toThrow(/LANDING_NOT_FOUND/);
  });
});
