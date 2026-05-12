import { Prisma, type PrismaClient, type LandingStatus } from '../../generated/prisma';
import { mapLanding } from './landing.mappers';
import type { LandingRecord } from './landing.types';

export type { LandingRecord, LandingTierRecord } from './landing.types';

export interface LandingListFilters {
  status?: LandingStatus | undefined;
  page: number;
  limit: number;
}

export interface LandingListRow {
  id: string;
  slug: string;
  status: LandingStatus;
  seoTitle: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tierCount: number;
}

export interface WriteTier {
  serviceId: string;
  order: number;
  pillKind: 'SALE' | 'MEGA_FAST' | 'PREMIUM' | null;
  glowKind: 'ORANGE' | 'COSMIC' | 'PURPLE' | null;
  titleOverride: string | null;
  descOverride: string | null;
  priceOverride: number | null;
  unit: string;
}

export interface LandingCreateData {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoOgImageUrl: string | null;
  heroEyebrow: string | null;
  heroTitle: string;
  heroAccent: string | null;
  heroLead: string;
  heroPlaceholder: string;
  heroCtaLabel: string;
  heroFineprint: string | null;
  heroMinAmount: number;
  defaultServiceId: string | null;
  stats: Prisma.InputJsonValue;
  steps: Prisma.InputJsonValue;
  faq: Prisma.InputJsonValue;
  footerCta: Prisma.InputJsonValue | null;
  tiers: WriteTier[];
}

export type LandingUpdateData = Partial<Omit<LandingCreateData, 'tiers'>> & {
  tiers?: WriteTier[];
};

export interface LandingAnalytics {
  views: number;
  calculatorUses: number;
  checkoutsStarted: number;
  checkoutsCompleted: number;
  revenueUsd: number;
}

export interface LandingRepository {
  findBySlug(slug: string): Promise<LandingRecord | null>;
  findById(id: string): Promise<LandingRecord | null>;
  list(filters: LandingListFilters): Promise<{ landings: LandingListRow[]; total: number }>;
  create(data: LandingCreateData): Promise<LandingRecord>;
  update(id: string, data: LandingUpdateData): Promise<LandingRecord>;
  setStatus(id: string, status: LandingStatus, publishedAt: Date | null): Promise<LandingRecord>;
  getAnalytics(landingId: string): Promise<LandingAnalytics>;
}

function toTierWrite(t: WriteTier): Prisma.LandingTierUncheckedCreateWithoutLandingInput {
  return {
    serviceId: t.serviceId,
    order: t.order,
    pillKind: t.pillKind,
    glowKind: t.glowKind,
    titleOverride: t.titleOverride,
    descOverride: t.descOverride,
    priceOverride: t.priceOverride,
    unit: t.unit,
  };
}

function buildUpdateScalars(data: LandingUpdateData): Prisma.LandingUpdateInput {
  const scalars: Prisma.LandingUpdateInput = {};
  const keys = [
    'slug',
    'seoTitle',
    'seoDescription',
    'seoOgImageUrl',
    'heroEyebrow',
    'heroTitle',
    'heroAccent',
    'heroLead',
    'heroPlaceholder',
    'heroCtaLabel',
    'heroFineprint',
    'heroMinAmount',
    'defaultServiceId',
    'stats',
    'steps',
    'faq',
  ] as const;
  for (const key of keys) {
    if (data[key] !== undefined) {
      (scalars as Record<string, unknown>)[key] = data[key];
    }
  }
  if (data.footerCta !== undefined) {
    scalars.footerCta = data.footerCta ?? Prisma.DbNull;
  }
  return scalars;
}

export function createLandingRepository(prisma: PrismaClient): LandingRepository {
  const includeTiers = {
    tiers: { include: { service: true }, orderBy: { order: 'asc' } },
  } as const;

  async function findBySlug(slug: string): Promise<LandingRecord | null> {
    const row = await prisma.landing.findUnique({ where: { slug }, include: includeTiers });
    return row ? mapLanding(row) : null;
  }

  async function findById(id: string): Promise<LandingRecord | null> {
    const row = await prisma.landing.findUnique({ where: { id }, include: includeTiers });
    return row ? mapLanding(row) : null;
  }

  async function list(
    filters: LandingListFilters,
  ): Promise<{ landings: LandingListRow[]; total: number }> {
    const where: Prisma.LandingWhereInput = filters.status ? { status: filters.status } : {};
    const [rows, total] = await Promise.all([
      prisma.landing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { _count: { select: { tiers: true } } },
      }),
      prisma.landing.count({ where }),
    ]);
    return {
      total,
      landings: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        status: r.status,
        seoTitle: r.seoTitle,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        tierCount: r._count.tiers,
      })),
    };
  }

  async function create(data: LandingCreateData): Promise<LandingRecord> {
    const row = await prisma.landing.create({
      data: {
        slug: data.slug,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        seoOgImageUrl: data.seoOgImageUrl,
        heroEyebrow: data.heroEyebrow,
        heroTitle: data.heroTitle,
        heroAccent: data.heroAccent,
        heroLead: data.heroLead,
        heroPlaceholder: data.heroPlaceholder,
        heroCtaLabel: data.heroCtaLabel,
        heroFineprint: data.heroFineprint,
        heroMinAmount: data.heroMinAmount,
        defaultServiceId: data.defaultServiceId,
        stats: data.stats,
        steps: data.steps,
        faq: data.faq,
        footerCta: data.footerCta ?? Prisma.DbNull,
        tiers: { create: data.tiers.map(toTierWrite) },
      },
      include: includeTiers,
    });
    return mapLanding(row);
  }

  async function update(id: string, data: LandingUpdateData): Promise<LandingRecord> {
    return prisma.$transaction(async (tx) => {
      if (data.tiers) {
        await tx.landingTier.deleteMany({ where: { landingId: id } });
      }
      const scalarData = buildUpdateScalars(data);
      if (data.tiers && data.tiers.length > 0) {
        scalarData.tiers = { create: data.tiers.map(toTierWrite) };
      }
      const row = await tx.landing.update({
        where: { id },
        data: scalarData,
        include: includeTiers,
      });
      return mapLanding(row);
    });
  }

  async function setStatus(
    id: string,
    status: LandingStatus,
    publishedAt: Date | null,
  ): Promise<LandingRecord> {
    const row = await prisma.landing.update({
      where: { id },
      data: { status, publishedAt },
      include: includeTiers,
    });
    return mapLanding(row);
  }

  async function getAnalytics(landingId: string): Promise<LandingAnalytics> {
    const [eventCounts, orderCounts] = await Promise.all([
      prisma.outboxEvent.groupBy({
        by: ['eventType'],
        where: { aggregateType: 'landing', aggregateId: landingId },
        _count: { _all: true },
      }),
      prisma.$queryRaw<
        Array<{
          checkouts_started: bigint;
          checkouts_completed: bigint;
          revenue_usd: number | null;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE o.id IN (
            SELECT (e.payload->>'orderId')::uuid
            FROM outbox_events e
            WHERE e.event_type = 'landing.guest_checkout_started'
              AND e.aggregate_id = ${landingId}::uuid
          )) AS checkouts_started,
          COUNT(*) FILTER (WHERE o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'FAILED')
            AND o.id IN (
              SELECT (e.payload->>'orderId')::uuid
              FROM outbox_events e
              WHERE e.event_type = 'landing.guest_checkout_started'
                AND e.aggregate_id = ${landingId}::uuid
            )) AS checkouts_completed,
          COALESCE(SUM(o.price) FILTER (WHERE o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'FAILED')
            AND o.id IN (
              SELECT (e.payload->>'orderId')::uuid
              FROM outbox_events e
              WHERE e.event_type = 'landing.guest_checkout_started'
                AND e.aggregate_id = ${landingId}::uuid
            )), 0) AS revenue_usd
        FROM orders o
      `,
    ]);

    const byType = new Map<string, number>();
    for (const row of eventCounts) byType.set(row.eventType, row._count._all);
    const head = orderCounts[0];

    return {
      views: byType.get('landing.viewed') ?? 0,
      calculatorUses: byType.get('landing.calculator_used') ?? 0,
      checkoutsStarted: Number(head?.checkouts_started ?? 0n),
      checkoutsCompleted: Number(head?.checkouts_completed ?? 0n),
      revenueUsd: Number(head?.revenue_usd ?? 0),
    };
  }

  return { findBySlug, findById, list, create, update, setStatus, getAnalytics };
}
