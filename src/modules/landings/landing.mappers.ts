import type { Prisma, LandingStatus } from '../../generated/prisma';
import type { LandingRecord, LandingTierRecord } from './landing.types';

export interface RawTier {
  id: string;
  serviceId: string;
  order: number;
  pillKind: 'SALE' | 'MEGA_FAST' | 'PREMIUM' | null;
  glowKind: 'ORANGE' | 'COSMIC' | 'PURPLE' | null;
  titleOverride: string | null;
  descOverride: string | null;
  priceOverride: { toString: () => string } | null;
  unit: string;
  service: {
    id: string;
    name: string;
    description: string | null;
    platform: string;
    type: string;
    pricePer1000: { toString: () => string };
    minQuantity: number;
    maxQuantity: number;
    refillDays: number | null;
    isActive: boolean;
  };
}

export interface RawLanding {
  id: string;
  slug: string;
  status: LandingStatus;
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
  heroMinAmount: { toString: () => string };
  defaultServiceId: string | null;
  stats: Prisma.JsonValue;
  steps: Prisma.JsonValue;
  faq: Prisma.JsonValue;
  footerCta: Prisma.JsonValue | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tiers: RawTier[];
}

export function mapTier(row: RawTier): LandingTierRecord {
  return {
    id: row.id,
    serviceId: row.serviceId,
    order: row.order,
    pillKind: row.pillKind,
    glowKind: row.glowKind,
    titleOverride: row.titleOverride,
    descOverride: row.descOverride,
    priceOverride: row.priceOverride ? row.priceOverride.toString() : null,
    unit: row.unit,
    service: {
      id: row.service.id,
      name: row.service.name,
      description: row.service.description,
      platform: row.service.platform,
      type: row.service.type,
      pricePer1000: row.service.pricePer1000.toString(),
      minQuantity: row.service.minQuantity,
      maxQuantity: row.service.maxQuantity,
      refillDays: row.service.refillDays,
      isActive: row.service.isActive,
    },
  };
}

export function mapLanding(row: RawLanding): LandingRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    seoOgImageUrl: row.seoOgImageUrl,
    heroEyebrow: row.heroEyebrow,
    heroTitle: row.heroTitle,
    heroAccent: row.heroAccent,
    heroLead: row.heroLead,
    heroPlaceholder: row.heroPlaceholder,
    heroCtaLabel: row.heroCtaLabel,
    heroFineprint: row.heroFineprint,
    heroMinAmount: row.heroMinAmount.toString(),
    defaultServiceId: row.defaultServiceId,
    stats: row.stats,
    steps: row.steps,
    faq: row.faq,
    footerCta: row.footerCta,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tiers: row.tiers.map(mapTier),
  };
}
