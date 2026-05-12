import { createLandingRepository } from '../landing.repository';
import type { Prisma, PrismaClient } from '../../../generated/prisma';

interface FakePrisma {
  prisma: PrismaClient;
  mocks: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    transaction: jest.Mock;
    tierDeleteMany: jest.Mock;
    txLandingUpdate: jest.Mock;
  };
}

function createFakePrisma(): FakePrisma {
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const tierDeleteMany = jest.fn();
  const txLandingUpdate = jest.fn();
  const transaction = jest.fn(
    async <T>(cb: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
      const tx = {
        landingTier: { deleteMany: tierDeleteMany },
        landing: { update: txLandingUpdate },
      } as unknown as Prisma.TransactionClient;
      return cb(tx);
    },
  );
  const prisma = {
    landing: { findUnique, findMany, count, create, update },
    $transaction: transaction,
  } as unknown as PrismaClient;
  return {
    prisma,
    mocks: {
      findUnique,
      findMany,
      count,
      create,
      update,
      transaction,
      tierDeleteMany,
      txLandingUpdate,
    },
  };
}

const fakeRow = {
  id: 'lnd-1',
  slug: 'home',
  status: 'PUBLISHED',
  seoTitle: 'YouBoost',
  seoDescription: 'boost your channel',
  seoOgImageUrl: null,
  heroEyebrow: null,
  heroTitle: 'Promote in 1 minute',
  heroAccent: null,
  heroLead: 'Get views',
  heroPlaceholder: 'paste link',
  heroCtaLabel: 'GO!',
  heroFineprint: null,
  heroMinAmount: { toString: (): string => '4.00' },
  defaultServiceId: null,
  stats: [],
  steps: [],
  faq: [],
  footerCta: null,
  publishedAt: new Date('2026-05-11T00:00:00Z'),
  createdAt: new Date('2026-05-11T00:00:00Z'),
  updatedAt: new Date('2026-05-11T00:00:00Z'),
  tiers: [
    {
      id: 'tier-1',
      serviceId: 'svc-1',
      order: 0,
      pillKind: 'SALE' as const,
      glowKind: 'ORANGE' as const,
      titleOverride: null,
      descOverride: null,
      priceOverride: { toString: (): string => '2.00' },
      unit: '1k',
      service: {
        id: 'svc-1',
        name: 'YouTube Views',
        description: null,
        platform: 'YOUTUBE',
        type: 'VIEWS',
        pricePer1000: { toString: (): string => '2.00' },
        minQuantity: 100,
        maxQuantity: 100000,
        refillDays: null,
        isActive: true,
      },
    },
  ],
};

describe('Landing Repository', () => {
  it('findBySlug returns mapped record on hit', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.findUnique.mockResolvedValue(fakeRow);
    const repo = createLandingRepository(prisma);

    const result = await repo.findBySlug('home');

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { slug: 'home' },
      include: { tiers: { include: { service: true }, orderBy: { order: 'asc' } } },
    });
    expect(result?.id).toBe('lnd-1');
    expect(result?.tiers[0]?.priceOverride).toBe('2.00');
  });

  it('findBySlug returns null on miss', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.findUnique.mockResolvedValue(null);
    const repo = createLandingRepository(prisma);

    expect(await repo.findBySlug('missing')).toBeNull();
  });

  it('list applies status filter + pagination', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.findMany.mockResolvedValue([{ ...fakeRow, _count: { tiers: 1 } }]);
    mocks.count.mockResolvedValue(1);
    const repo = createLandingRepository(prisma);

    const result = await repo.list({ status: 'PUBLISHED', page: 2, limit: 5 });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      take: 5,
      include: { _count: { select: { tiers: true } } },
    });
    expect(result.total).toBe(1);
    expect(result.landings[0]?.tierCount).toBe(1);
  });

  it('list without filter uses empty where', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    const repo = createLandingRepository(prisma);

    await repo.list({ page: 1, limit: 20 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('setStatus sets status + publishedAt', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.update.mockResolvedValue(fakeRow);
    const repo = createLandingRepository(prisma);
    const now = new Date('2026-05-11T12:00:00Z');

    await repo.setStatus('lnd-1', 'PUBLISHED', now);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'lnd-1' },
      data: { status: 'PUBLISHED', publishedAt: now },
      include: { tiers: { include: { service: true }, orderBy: { order: 'asc' } } },
    });
  });

  it('update with tiers runs transaction that deletes old tiers first', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.txLandingUpdate.mockResolvedValue(fakeRow);
    const repo = createLandingRepository(prisma);

    await repo.update('lnd-1', {
      seoTitle: 'New',
      tiers: [
        {
          serviceId: 'svc-1',
          order: 0,
          pillKind: 'SALE',
          glowKind: 'ORANGE',
          titleOverride: null,
          descOverride: null,
          priceOverride: null,
          unit: '1k',
        },
      ],
    });

    expect(mocks.tierDeleteMany).toHaveBeenCalledWith({ where: { landingId: 'lnd-1' } });
    expect(mocks.txLandingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lnd-1' },
        data: expect.objectContaining({ seoTitle: 'New' }),
      }),
    );
  });

  it('update without tiers skips deleteMany', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.txLandingUpdate.mockResolvedValue(fakeRow);
    const repo = createLandingRepository(prisma);

    await repo.update('lnd-1', { seoTitle: 'Renamed' });

    expect(mocks.tierDeleteMany).not.toHaveBeenCalled();
    expect(mocks.txLandingUpdate).toHaveBeenCalled();
  });

  it('create persists tiers via nested create', async () => {
    const { prisma, mocks } = createFakePrisma();
    mocks.create.mockResolvedValue(fakeRow);
    const repo = createLandingRepository(prisma);

    await repo.create({
      slug: 'home',
      seoTitle: 't',
      seoDescription: 'd',
      seoOgImageUrl: null,
      heroEyebrow: null,
      heroTitle: 'ht',
      heroAccent: null,
      heroLead: 'hl',
      heroPlaceholder: 'hp',
      heroCtaLabel: 'GO!',
      heroFineprint: null,
      heroMinAmount: 4,
      defaultServiceId: null,
      stats: [],
      steps: [],
      faq: [],
      footerCta: null,
      tiers: [
        {
          serviceId: 'svc-1',
          order: 0,
          pillKind: null,
          glowKind: null,
          titleOverride: null,
          descOverride: null,
          priceOverride: null,
          unit: '1k',
        },
      ],
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'home',
          tiers: { create: [expect.objectContaining({ serviceId: 'svc-1', order: 0 })] },
        }),
      }),
    );
  });
});
