import type {
  LandingListFilters,
  LandingListRow,
  LandingRecord,
  LandingRepository,
  LandingCreateData,
  LandingUpdateData,
} from '../landing.repository';
import type { LandingStatus } from '../../../generated/prisma';

export interface SeedLanding extends LandingRecord {}

export function createFakeLandingRepository(
  seed: SeedLanding[] = [],
): LandingRepository & { store: Map<string, LandingRecord>; calls: Record<string, unknown[]> } {
  const store = new Map<string, LandingRecord>();
  for (const row of seed) store.set(row.id, row);
  const calls: Record<string, unknown[]> = {
    findBySlug: [],
    findById: [],
    list: [],
    create: [],
    update: [],
    setStatus: [],
  };

  function clone(record: LandingRecord): LandingRecord {
    return { ...record, tiers: record.tiers.map((t) => ({ ...t, service: { ...t.service } })) };
  }

  async function findBySlug(slug: string): Promise<LandingRecord | null> {
    calls.findBySlug?.push(slug);
    for (const record of store.values()) {
      if (record.slug === slug) return clone(record);
    }
    return null;
  }

  async function findById(id: string): Promise<LandingRecord | null> {
    calls.findById?.push(id);
    const row = store.get(id);
    return row ? clone(row) : null;
  }

  async function list(
    filters: LandingListFilters,
  ): Promise<{ landings: LandingListRow[]; total: number }> {
    calls.list?.push(filters);
    let rows = [...store.values()];
    if (filters.status) rows = rows.filter((r) => r.status === filters.status);
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = rows.length;
    const start = (filters.page - 1) * filters.limit;
    const page = rows.slice(start, start + filters.limit);
    return {
      total,
      landings: page.map((r) => ({
        id: r.id,
        slug: r.slug,
        status: r.status,
        seoTitle: r.seoTitle,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        tierCount: r.tiers.length,
      })),
    };
  }

  async function create(data: LandingCreateData): Promise<LandingRecord> {
    calls.create?.push(data);
    const id = `landing-${store.size + 1}`;
    const record: LandingRecord = {
      id,
      slug: data.slug,
      status: 'DRAFT' as LandingStatus,
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
      heroMinAmount: String(data.heroMinAmount),
      defaultServiceId: data.defaultServiceId,
      stats: data.stats as unknown as LandingRecord['stats'],
      steps: data.steps as unknown as LandingRecord['steps'],
      faq: data.faq as unknown as LandingRecord['faq'],
      footerCta: (data.footerCta ?? null) as unknown as LandingRecord['footerCta'],
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      tiers: data.tiers.map((t, idx) => ({
        id: `${id}-tier-${idx}`,
        serviceId: t.serviceId,
        order: t.order,
        pillKind: t.pillKind,
        glowKind: t.glowKind,
        titleOverride: t.titleOverride,
        descOverride: t.descOverride,
        priceOverride: t.priceOverride !== null ? String(t.priceOverride) : null,
        unit: t.unit,
        service: {
          id: t.serviceId,
          name: `Service ${t.serviceId}`,
          description: null,
          platform: 'YOUTUBE',
          type: 'VIEWS',
          pricePer1000: '2.00',
          minQuantity: 100,
          maxQuantity: 100000,
          refillDays: null,
          isActive: true,
        },
      })),
    };
    store.set(id, record);
    return clone(record);
  }

  async function update(id: string, data: LandingUpdateData): Promise<LandingRecord> {
    calls.update?.push({ id, data });
    const existing = store.get(id);
    if (!existing) throw new Error(`landing ${id} not found in fake`);
    const updated: LandingRecord = {
      ...existing,
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
      ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
      ...(data.seoOgImageUrl !== undefined && { seoOgImageUrl: data.seoOgImageUrl }),
      ...(data.heroEyebrow !== undefined && { heroEyebrow: data.heroEyebrow }),
      ...(data.heroTitle !== undefined && { heroTitle: data.heroTitle }),
      ...(data.heroAccent !== undefined && { heroAccent: data.heroAccent }),
      ...(data.heroLead !== undefined && { heroLead: data.heroLead }),
      ...(data.heroPlaceholder !== undefined && { heroPlaceholder: data.heroPlaceholder }),
      ...(data.heroCtaLabel !== undefined && { heroCtaLabel: data.heroCtaLabel }),
      ...(data.heroFineprint !== undefined && { heroFineprint: data.heroFineprint }),
      ...(data.heroMinAmount !== undefined && { heroMinAmount: String(data.heroMinAmount) }),
      ...(data.defaultServiceId !== undefined && { defaultServiceId: data.defaultServiceId }),
      ...(data.stats !== undefined && { stats: data.stats as unknown as LandingRecord['stats'] }),
      ...(data.steps !== undefined && { steps: data.steps as unknown as LandingRecord['steps'] }),
      ...(data.faq !== undefined && { faq: data.faq as unknown as LandingRecord['faq'] }),
      ...(data.footerCta !== undefined && {
        footerCta: (data.footerCta ?? null) as unknown as LandingRecord['footerCta'],
      }),
      ...(data.tiers !== undefined && {
        tiers: data.tiers.map((t, idx) => ({
          id: `${id}-tier-${idx}`,
          serviceId: t.serviceId,
          order: t.order,
          pillKind: t.pillKind,
          glowKind: t.glowKind,
          titleOverride: t.titleOverride,
          descOverride: t.descOverride,
          priceOverride: t.priceOverride !== null ? String(t.priceOverride) : null,
          unit: t.unit,
          service: existing.tiers.find((existTier) => existTier.serviceId === t.serviceId)
            ?.service ?? {
            id: t.serviceId,
            name: `Service ${t.serviceId}`,
            description: null,
            platform: 'YOUTUBE',
            type: 'VIEWS',
            pricePer1000: '2.00',
            minQuantity: 100,
            maxQuantity: 100000,
            refillDays: null,
            isActive: true,
          },
        })),
      }),
      updatedAt: new Date(),
    };
    store.set(id, updated);
    return clone(updated);
  }

  async function setStatus(
    id: string,
    status: LandingStatus,
    publishedAt: Date | null,
  ): Promise<LandingRecord> {
    calls.setStatus?.push({ id, status, publishedAt });
    const existing = store.get(id);
    if (!existing) throw new Error(`landing ${id} not found in fake`);
    const updated = { ...existing, status, publishedAt, updatedAt: new Date() };
    store.set(id, updated);
    return clone(updated);
  }

  async function getAnalytics(_landingId: string): Promise<{
    views: number;
    calculatorUses: number;
    checkoutsStarted: number;
    checkoutsCompleted: number;
    revenueUsd: number;
  }> {
    return {
      views: 0,
      calculatorUses: 0,
      checkoutsStarted: 0,
      checkoutsCompleted: 0,
      revenueUsd: 0,
    };
  }

  return { findBySlug, findById, list, create, update, setStatus, getAnalytics, store, calls };
}

export const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: (): unknown => silentLogger,
  level: 'silent',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

export const fixedClock = {
  now: (): Date => new Date('2026-05-11T00:00:00Z'),
};
