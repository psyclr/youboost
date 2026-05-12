import type { Prisma, PrismaClient } from '../../../generated/prisma';
import type { OutboxEvent, OutboxPort } from '../../../shared/outbox';
import { createLandingService } from '../landing.service';
import type { LandingCreateInput, LandingUpdateInput } from '../landing.types';
import { createFakeLandingRepository, fixedClock, silentLogger } from './fakes';
import type { LandingRepository } from '../landing.repository';
import type { ServiceLookupPort, ServiceLookupRecord } from '../ports/service-lookup.port';
import type {
  AutoUserCreatorPort,
  GuestOrderCreatorPort,
  GuestOrderStripePort,
} from '../ports/guest-checkout.ports';

function createFakeOutbox(): { port: OutboxPort; events: OutboxEvent[] } {
  const events: OutboxEvent[] = [];
  return {
    port: {
      async emit(event): Promise<void> {
        events.push(event);
      },
    },
    events,
  };
}

function createFakePrisma(): PrismaClient {
  const tx = {} as Prisma.TransactionClient;
  return {
    $transaction: async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => cb(tx),
  } as unknown as PrismaClient;
}

const baseInput: LandingCreateInput = {
  slug: 'home',
  seoTitle: 'YouBoost — Boost your social media',
  seoDescription: 'Premium SMM services for YouTube creators.',
  heroTitle: 'Promote in 1 minute',
  heroAccent: 'without registration',
  heroLead: 'Get views, likes and much more. The fastest way in the world.',
  heroPlaceholder: 'Enter a link to your video or channel',
  heroCtaLabel: 'GO!',
  heroFineprint: '*minimum order amount $4.00',
  heroMinAmount: 4,
  stats: [
    { value: '1000+', label: 'Services' },
    { value: 'Instant', label: 'Delivery' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Support' },
  ],
  steps: [
    { n: 1, title: 'Register', description: 'Create your free account in seconds.' },
    { n: 2, title: 'Fund Account', description: 'Add funds with card, PayPal or crypto.' },
    { n: 3, title: 'Place Orders', description: 'Pick a service. Watch your channel grow.' },
  ],
  faq: [
    {
      question: 'Do I need to register to place an order?',
      answer: 'No, paste a link, pick a service, pay in one minute.',
    },
  ],
  tiers: [
    {
      serviceId: '00000000-0000-0000-0000-000000000001',
      order: 0,
      pillKind: 'SALE',
      glowKind: 'ORANGE',
      unit: '1k',
    },
    {
      serviceId: '00000000-0000-0000-0000-000000000002',
      order: 1,
      pillKind: null,
      glowKind: null,
      unit: '1k',
    },
  ],
};

function createFakeServiceLookup(seed: Partial<ServiceLookupRecord> = {}): {
  port: ServiceLookupPort;
  calls: string[];
  record: ServiceLookupRecord;
} {
  const record: ServiceLookupRecord = {
    id: seed.id ?? '00000000-0000-0000-0000-000000000001',
    name: seed.name ?? 'YouTube Views',
    pricePer1000: seed.pricePer1000 ?? 2,
    minQuantity: seed.minQuantity ?? 100,
    maxQuantity: seed.maxQuantity ?? 100000,
  };
  const calls: string[] = [];
  return {
    port: {
      async getService(serviceId): Promise<ServiceLookupRecord> {
        calls.push(serviceId);
        if (serviceId !== record.id) throw new Error('service not found');
        return record;
      },
    },
    calls,
    record,
  };
}

function setup(serviceLookupSeed: Partial<ServiceLookupRecord> = {}): {
  service: ReturnType<typeof createLandingService>;
  landingRepo: ReturnType<typeof createFakeLandingRepository>;
  outbox: ReturnType<typeof createFakeOutbox>;
  serviceLookup: ReturnType<typeof createFakeServiceLookup>;
} {
  const landingRepo = createFakeLandingRepository();
  const outbox = createFakeOutbox();
  const prisma = createFakePrisma();
  const serviceLookup = createFakeServiceLookup(serviceLookupSeed);
  const autoUserCreator: AutoUserCreatorPort = {
    async createAutoUser(email): Promise<{ userId: string; email: string; fresh: boolean }> {
      return { userId: `user-${email}`, email, fresh: true };
    },
  };
  const orderCreator: GuestOrderCreatorPort = {
    async createPendingPaymentOrder(): Promise<{ orderId: string }> {
      return { orderId: 'order-fake' };
    },
    async attachStripeSessionId(): Promise<void> {
      /* noop */
    },
  };
  const stripe: GuestOrderStripePort = {
    async createGuestOrderSession(): Promise<{ sessionId: string; url: string }> {
      return { sessionId: 'cs_fake', url: 'https://stripe.test/cs_fake' };
    },
  };
  const service = createLandingService({
    prisma,
    landingRepo: landingRepo as unknown as LandingRepository,
    serviceLookup: serviceLookup.port,
    autoUserCreator,
    orderCreator,
    stripe,
    outbox: outbox.port,
    clock: fixedClock,
    appUrl: 'http://app.test',
    logger: silentLogger,
  });
  return { service, landingRepo, outbox, serviceLookup };
}

describe('Landing Service', () => {
  describe('adminCreate', () => {
    it('creates a DRAFT landing with tiers', async () => {
      const { service, landingRepo } = setup();
      const result = await service.adminCreate(baseInput);

      expect(result.slug).toBe('home');
      expect(result.status).toBe('DRAFT');
      expect(result.tiers).toHaveLength(2);
      expect(result.tiers[0]?.pillKind).toBe('SALE');
      expect(landingRepo.calls.create).toHaveLength(1);
    });

    it('rejects duplicate slug with conflict error', async () => {
      const { service } = setup();
      await service.adminCreate(baseInput);
      await expect(service.adminCreate(baseInput)).rejects.toMatchObject({
        code: 'LANDING_SLUG_CONFLICT',
      });
    });

    it('rejects duplicate tier orders with validation error', async () => {
      const { service } = setup();
      const input: LandingCreateInput = {
        ...baseInput,
        tiers: [
          { ...baseInput.tiers[0]!, order: 0 },
          { ...baseInput.tiers[1]!, order: 0 },
        ],
      };
      await expect(service.adminCreate(input)).rejects.toMatchObject({
        code: 'LANDING_TIER_ORDER_CONFLICT',
      });
    });

    it('rejects duplicate tier serviceIds with validation error', async () => {
      const { service } = setup();
      const input: LandingCreateInput = {
        ...baseInput,
        tiers: [
          { ...baseInput.tiers[0]!, order: 0 },
          { ...baseInput.tiers[0]!, order: 1 },
        ],
      };
      await expect(service.adminCreate(input)).rejects.toMatchObject({
        code: 'LANDING_TIER_SERVICE_CONFLICT',
      });
    });
  });

  describe('adminPublish / adminUnpublish / adminArchive', () => {
    it('publish flips status and stamps publishedAt via clock', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);

      const published = await service.adminPublish(created.id);

      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).toBe(fixedClock.now().toISOString());
    });

    it('unpublish flips back to DRAFT and clears publishedAt', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);
      await service.adminPublish(created.id);

      const drafted = await service.adminUnpublish(created.id);

      expect(drafted.status).toBe('DRAFT');
      expect(drafted.publishedAt).toBeNull();
    });

    it('archive flips to ARCHIVED', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);

      const archived = await service.adminArchive(created.id);

      expect(archived.status).toBe('ARCHIVED');
    });

    it('throws NotFoundError on unknown id', async () => {
      const { service } = setup();
      await expect(service.adminPublish('nope')).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
      await expect(service.adminUnpublish('nope')).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
      await expect(service.adminArchive('nope')).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });
  });

  describe('getPublishedBySlug', () => {
    it('returns published landing and emits landing.viewed', async () => {
      const { service, outbox } = setup();
      const created = await service.adminCreate(baseInput);
      await service.adminPublish(created.id);

      const result = await service.getPublishedBySlug('home', {
        userId: 'user-1',
        userAgent: 'test-agent',
        referrer: 'https://google.com',
      });

      expect(result.slug).toBe('home');
      expect(outbox.events).toHaveLength(1);
      expect(outbox.events[0]).toMatchObject({
        type: 'landing.viewed',
        aggregateType: 'landing',
        userId: 'user-1',
        payload: {
          landingId: created.id,
          slug: 'home',
          userAgent: 'test-agent',
          referrer: 'https://google.com',
        },
      });
    });

    it('omits undefined context fields from payload', async () => {
      const { service, outbox } = setup();
      const created = await service.adminCreate(baseInput);
      await service.adminPublish(created.id);

      await service.getPublishedBySlug('home', {});

      expect(outbox.events[0]?.payload).toEqual({
        landingId: created.id,
        slug: 'home',
      });
      expect(outbox.events[0]?.userId).toBeNull();
    });

    it('throws NotFoundError for DRAFT landing', async () => {
      const { service } = setup();
      await service.adminCreate(baseInput);
      await expect(service.getPublishedBySlug('home', {})).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });

    it('throws NotFoundError for ARCHIVED landing', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);
      await service.adminArchive(created.id);
      await expect(service.getPublishedBySlug('home', {})).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });

    it('throws NotFoundError for unknown slug', async () => {
      const { service } = setup();
      await expect(service.getPublishedBySlug('ghost', {})).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });
  });

  describe('adminUpdate', () => {
    it('updates scalar fields and returns new record', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);

      const updated = await service.adminUpdate(created.id, {
        seoTitle: 'New Title',
      } as LandingUpdateInput);

      expect(updated.seoTitle).toBe('New Title');
      expect(updated.hero.title).toBe(baseInput.heroTitle);
    });

    it('detects slug conflict when changing slug to an existing landing', async () => {
      const { service } = setup();
      await service.adminCreate(baseInput);
      const other = await service.adminCreate({ ...baseInput, slug: 'promo' });

      await expect(
        service.adminUpdate(other.id, { slug: 'home' } as LandingUpdateInput),
      ).rejects.toMatchObject({ code: 'LANDING_SLUG_CONFLICT' });
    });

    it('accepts slug change when target is the current landing', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);

      const updated = await service.adminUpdate(created.id, { slug: 'home' } as LandingUpdateInput);

      expect(updated.slug).toBe('home');
    });

    it('throws NotFound on unknown id', async () => {
      const { service } = setup();
      await expect(service.adminUpdate('nope', {})).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });
  });

  describe('adminList / adminGet', () => {
    it('lists landings with pagination + totalPages', async () => {
      const { service } = setup();
      await service.adminCreate(baseInput);
      await service.adminCreate({ ...baseInput, slug: 'promo' });
      await service.adminCreate({ ...baseInput, slug: 'bf' });

      const result = await service.adminList({ page: 1, limit: 2 });

      expect(result.landings).toHaveLength(2);
      expect(result.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it('filters by status', async () => {
      const { service } = setup();
      const created = await service.adminCreate(baseInput);
      await service.adminPublish(created.id);
      await service.adminCreate({ ...baseInput, slug: 'draft-one' });

      const result = await service.adminList({ page: 1, limit: 20, status: 'PUBLISHED' });

      expect(result.landings).toHaveLength(1);
      expect(result.landings[0]?.status).toBe('PUBLISHED');
    });

    it('adminGet throws NotFound when absent', async () => {
      const { service } = setup();
      await expect(service.adminGet('nope')).rejects.toMatchObject({
        code: 'LANDING_NOT_FOUND',
      });
    });
  });

  describe('calculate', () => {
    async function withPublished(serviceLookupSeed: Partial<ServiceLookupRecord> = {}) {
      const ctx = setup(serviceLookupSeed);
      const landing = await ctx.service.adminCreate(baseInput);
      await ctx.service.adminPublish(landing.id);
      return { ...ctx, landing };
    }

    it('returns valid price when quantity within bounds', async () => {
      const { service, outbox } = await withPublished({ pricePer1000: 2 });

      const result = await service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000000001',
        quantity: 1000,
      });

      expect(result).toEqual({
        valid: true,
        price: 2,
        serviceId: '00000000-0000-0000-0000-000000000001',
        quantity: 1000,
        reason: null,
      });
      expect(outbox.events.at(-1)?.type).toBe('landing.calculator_used');
    });

    it('rounds price to 2 decimals', async () => {
      const { service } = await withPublished({ pricePer1000: 2.35 });

      const result = await service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000000001',
        quantity: 333,
      });

      expect(result.price).toBeCloseTo(0.78, 2);
    });

    it('rejects service not on landing without outbox emit', async () => {
      const { service, outbox } = await withPublished();
      const tally = outbox.events.length;

      const result = await service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000009999',
        quantity: 1000,
      });

      expect(result).toMatchObject({ valid: false, reason: 'SERVICE_NOT_ON_LANDING' });
      expect(outbox.events).toHaveLength(tally);
    });

    it('rejects quantity below min with reason tag', async () => {
      const { service } = await withPublished({ minQuantity: 500 });

      const result = await service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000000001',
        quantity: 100,
      });

      expect(result).toMatchObject({ valid: false, reason: 'QUANTITY_BELOW_MIN:500' });
    });

    it('rejects quantity above max with reason tag', async () => {
      const { service } = await withPublished({ maxQuantity: 5000 });

      const result = await service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000000001',
        quantity: 99999,
      });

      expect(result).toMatchObject({ valid: false, reason: 'QUANTITY_ABOVE_MAX:5000' });
    });

    it('throws NotFound when landing missing', async () => {
      const { service } = setup();

      await expect(
        service.calculate('ghost', {
          serviceId: '00000000-0000-0000-0000-000000000001',
          quantity: 100,
        }),
      ).rejects.toMatchObject({ code: 'LANDING_NOT_FOUND' });
    });

    it('throws NotFound when landing is DRAFT', async () => {
      const ctx = setup();
      await ctx.service.adminCreate(baseInput);

      await expect(
        ctx.service.calculate('home', {
          serviceId: '00000000-0000-0000-0000-000000000001',
          quantity: 100,
        }),
      ).rejects.toMatchObject({ code: 'LANDING_NOT_FOUND' });
    });

    it('returns SERVICE_NOT_FOUND if lookup throws', async () => {
      const ctx = setup();
      const landing = await ctx.service.adminCreate(baseInput);
      await ctx.service.adminPublish(landing.id);
      // serviceLookup fake throws when serviceId !== seed id (default 00...001)
      const result = await ctx.service.calculate('home', {
        serviceId: '00000000-0000-0000-0000-000000000002',
        quantity: 100,
      });
      expect(result).toMatchObject({ valid: false, reason: 'SERVICE_NOT_FOUND' });
    });
  });
});
