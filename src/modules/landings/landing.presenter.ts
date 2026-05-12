import { ValidationError } from '../../shared/errors';
import type { LandingRecord, LandingTierRecord } from './landing.repository';
import {
  landingStatsSchema,
  landingStepsSchema,
  landingFaqSchema,
  landingFooterCtaSchema,
  type AdminLandingListItem,
  type LandingFaq,
  type LandingFooterCta,
  type LandingResponse,
  type LandingStats,
  type LandingSteps,
  type LandingTierResponse,
} from './landing.types';

function parseStats(value: unknown): LandingStats {
  const result = landingStatsSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid stats JSON in landing', 'LANDING_STATS_INVALID');
  }
  return result.data;
}

function parseSteps(value: unknown): LandingSteps {
  const result = landingStepsSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid steps JSON in landing', 'LANDING_STEPS_INVALID');
  }
  return result.data;
}

function parseFaq(value: unknown): LandingFaq {
  const result = landingFaqSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid faq JSON in landing', 'LANDING_FAQ_INVALID');
  }
  return result.data;
}

function parseFooterCta(value: unknown): LandingFooterCta | null {
  if (value === null || value === undefined) return null;
  const result = landingFooterCtaSchema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid footerCta JSON in landing', 'LANDING_FOOTER_CTA_INVALID');
  }
  return result.data;
}

function mapTier(tier: LandingTierRecord): LandingTierResponse {
  return {
    id: tier.id,
    serviceId: tier.serviceId,
    order: tier.order,
    pillKind: tier.pillKind,
    glowKind: tier.glowKind,
    titleOverride: tier.titleOverride,
    descOverride: tier.descOverride,
    priceOverride: tier.priceOverride ? Number(tier.priceOverride) : null,
    unit: tier.unit,
    service: {
      id: tier.service.id,
      name: tier.service.name,
      description: tier.service.description,
      platform: tier.service.platform,
      type: tier.service.type,
      pricePer1000: Number(tier.service.pricePer1000),
      minQuantity: tier.service.minQuantity,
      maxQuantity: tier.service.maxQuantity,
      refillDays: tier.service.refillDays,
    },
  };
}

export function presentLanding(record: LandingRecord): LandingResponse {
  return {
    id: record.id,
    slug: record.slug,
    status: record.status,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    seoOgImageUrl: record.seoOgImageUrl,
    hero: {
      eyebrow: record.heroEyebrow,
      title: record.heroTitle,
      accent: record.heroAccent,
      lead: record.heroLead,
      placeholder: record.heroPlaceholder,
      ctaLabel: record.heroCtaLabel,
      fineprint: record.heroFineprint,
      minAmount: Number(record.heroMinAmount),
      defaultServiceId: record.defaultServiceId,
    },
    stats: parseStats(record.stats),
    steps: parseSteps(record.steps),
    faq: parseFaq(record.faq),
    footerCta: parseFooterCta(record.footerCta),
    tiers: record.tiers.map(mapTier),
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentListItem(row: {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoTitle: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tierCount: number;
}): AdminLandingListItem {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    seoTitle: row.seoTitle,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tierCount: row.tierCount,
  };
}
