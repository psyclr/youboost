import { ValidationError } from '../../shared/errors';
import type { LandingCreateData, LandingUpdateData, WriteTier } from './landing.repository';
import type { LandingCreateInput, LandingTierInput, LandingUpdateInput } from './landing.types';

export function mapInputTier(t: LandingTierInput): WriteTier {
  return {
    serviceId: t.serviceId,
    order: t.order,
    pillKind: t.pillKind ?? null,
    glowKind: t.glowKind ?? null,
    titleOverride: t.titleOverride ?? null,
    descOverride: t.descOverride ?? null,
    priceOverride: t.priceOverride ?? null,
    unit: t.unit,
  };
}

export function buildUpdateData(input: LandingUpdateInput): LandingUpdateData {
  const data: LandingUpdateData = {};
  type Scalar = Exclude<keyof LandingUpdateInput, 'tiers' | 'footerCta'>;
  const scalars: Scalar[] = [
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
  ];
  for (const key of scalars) {
    const value = input[key];
    if (value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }
  if (input.footerCta !== undefined) {
    data.footerCta = input.footerCta ?? null;
  }
  if (input.tiers !== undefined) {
    data.tiers = input.tiers.map(mapInputTier);
  }
  return data;
}

export function validateTiersUnique(
  tiers: ReadonlyArray<{ order: number; serviceId: string }>,
): void {
  const orders = new Set<number>();
  const services = new Set<string>();
  for (const tier of tiers) {
    if (orders.has(tier.order)) {
      throw new ValidationError(
        `Duplicate tier order ${tier.order}`,
        'LANDING_TIER_ORDER_CONFLICT',
      );
    }
    if (services.has(tier.serviceId)) {
      throw new ValidationError(
        `Duplicate tier service ${tier.serviceId}`,
        'LANDING_TIER_SERVICE_CONFLICT',
      );
    }
    orders.add(tier.order);
    services.add(tier.serviceId);
  }
}

export function buildCreateData(input: LandingCreateInput): LandingCreateData {
  return {
    slug: input.slug,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    seoOgImageUrl: input.seoOgImageUrl ?? null,
    heroEyebrow: input.heroEyebrow ?? null,
    heroTitle: input.heroTitle,
    heroAccent: input.heroAccent ?? null,
    heroLead: input.heroLead,
    heroPlaceholder: input.heroPlaceholder,
    heroCtaLabel: input.heroCtaLabel,
    heroFineprint: input.heroFineprint ?? null,
    heroMinAmount: input.heroMinAmount,
    defaultServiceId: input.defaultServiceId ?? null,
    stats: input.stats,
    steps: input.steps,
    faq: input.faq,
    footerCta: input.footerCta ?? null,
    tiers: input.tiers.map(mapInputTier),
  };
}
