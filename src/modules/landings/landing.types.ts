import { z } from 'zod/v4';

// -----------------------------------------------------------------------------
// JSONB block schemas — fixed shape, validated at service layer on write/read.
// -----------------------------------------------------------------------------

export const landingStatItemSchema = z.object({
  value: z.string().min(1).max(32),
  label: z.string().min(1).max(48),
});

export const landingStepItemSchema = z.object({
  n: z.number().int().min(1).max(9),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
});

export const landingFaqItemSchema = z.object({
  question: z.string().min(1).max(200),
  answer: z.string().min(1).max(800),
});

export const landingFooterCtaSchema = z
  .object({
    title: z.string().min(1).max(120),
    lead: z.string().min(1).max(240),
    label: z.string().min(1).max(40),
    href: z.string().min(1).max(255),
  })
  .nullable();

export const landingStatsSchema = z.array(landingStatItemSchema).length(4);
export const landingStepsSchema = z.array(landingStepItemSchema).length(3);
export const landingFaqSchema = z.array(landingFaqItemSchema).min(1).max(12);

export type LandingStatItem = z.infer<typeof landingStatItemSchema>;
export type LandingStepItem = z.infer<typeof landingStepItemSchema>;
export type LandingFaqItem = z.infer<typeof landingFaqItemSchema>;
export type LandingFooterCta = z.infer<typeof landingFooterCtaSchema>;
export type LandingStats = z.infer<typeof landingStatsSchema>;
export type LandingSteps = z.infer<typeof landingStepsSchema>;
export type LandingFaq = z.infer<typeof landingFaqSchema>;

// -----------------------------------------------------------------------------
// Request/route schemas
// -----------------------------------------------------------------------------

export const landingSlugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be lowercase alphanumeric with optional hyphens'),
});

export const landingIdParamSchema = z.object({
  landingId: z.uuid(),
});

export const landingTierPillSchema = z.enum(['SALE', 'MEGA_FAST', 'PREMIUM']);
export const landingTierGlowSchema = z.enum(['ORANGE', 'COSMIC', 'PURPLE']);
export const landingStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

export const landingTierInputSchema = z.object({
  serviceId: z.uuid(),
  order: z.number().int().min(0).max(99),
  pillKind: landingTierPillSchema.nullable().optional(),
  glowKind: landingTierGlowSchema.nullable().optional(),
  titleOverride: z.string().max(160).nullable().optional(),
  descOverride: z.string().max(320).nullable().optional(),
  priceOverride: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(16).default('1k'),
});

const landingBaseSchema = z.object({
  slug: landingSlugParamSchema.shape.slug,
  seoTitle: z.string().min(1).max(160),
  seoDescription: z.string().min(1).max(320),
  seoOgImageUrl: z.string().max(512).nullable().optional(),
  heroEyebrow: z.string().max(120).nullable().optional(),
  heroTitle: z.string().min(1).max(160),
  heroAccent: z.string().max(160).nullable().optional(),
  heroLead: z.string().min(1).max(500),
  heroPlaceholder: z.string().min(1).max(160),
  heroCtaLabel: z.string().min(1).max(32).default('GO!'),
  heroFineprint: z.string().max(160).nullable().optional(),
  heroMinAmount: z.number().nonnegative().default(4),
  defaultServiceId: z.uuid().nullable().optional(),
  stats: landingStatsSchema,
  steps: landingStepsSchema,
  faq: landingFaqSchema,
  footerCta: landingFooterCtaSchema.optional(),
  tiers: z.array(landingTierInputSchema).min(1).max(8),
});

export const landingCreateSchema = landingBaseSchema;
export const landingUpdateSchema = landingBaseSchema.partial();

export const adminLandingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: landingStatusSchema.optional(),
});

export type LandingCreateInput = z.infer<typeof landingCreateSchema>;
export type LandingUpdateInput = z.infer<typeof landingUpdateSchema>;
export type LandingTierInput = z.infer<typeof landingTierInputSchema>;
export type AdminLandingsQuery = z.infer<typeof adminLandingsQuerySchema>;

// -----------------------------------------------------------------------------
// Response shapes
// -----------------------------------------------------------------------------

export interface LandingTierResponse {
  id: string;
  serviceId: string;
  order: number;
  pillKind: 'SALE' | 'MEGA_FAST' | 'PREMIUM' | null;
  glowKind: 'ORANGE' | 'COSMIC' | 'PURPLE' | null;
  titleOverride: string | null;
  descOverride: string | null;
  priceOverride: number | null;
  unit: string;
  service: {
    id: string;
    name: string;
    description: string | null;
    platform: string;
    type: string;
    pricePer1000: number;
    minQuantity: number;
    maxQuantity: number;
    refillDays: number | null;
  };
}

export interface LandingResponse {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoTitle: string;
  seoDescription: string;
  seoOgImageUrl: string | null;
  hero: {
    eyebrow: string | null;
    title: string;
    accent: string | null;
    lead: string;
    placeholder: string;
    ctaLabel: string;
    fineprint: string | null;
    minAmount: number;
    defaultServiceId: string | null;
  };
  stats: LandingStats;
  steps: LandingSteps;
  faq: LandingFaq;
  footerCta: LandingFooterCta | null;
  tiers: LandingTierResponse[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLandingListItem {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoTitle: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tierCount: number;
}

export interface PaginatedLandings {
  landings: AdminLandingListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// -----------------------------------------------------------------------------
// Repository row shapes (shared with mappers / presenter)
// -----------------------------------------------------------------------------

export interface LandingTierRecord {
  id: string;
  serviceId: string;
  order: number;
  pillKind: 'SALE' | 'MEGA_FAST' | 'PREMIUM' | null;
  glowKind: 'ORANGE' | 'COSMIC' | 'PURPLE' | null;
  titleOverride: string | null;
  descOverride: string | null;
  priceOverride: string | null;
  unit: string;
  service: {
    id: string;
    name: string;
    description: string | null;
    platform: string;
    type: string;
    pricePer1000: string;
    minQuantity: number;
    maxQuantity: number;
    refillDays: number | null;
    isActive: boolean;
  };
}

export interface LandingRecord {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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
  heroMinAmount: string;
  defaultServiceId: string | null;
  stats: unknown;
  steps: unknown;
  faq: unknown;
  footerCta: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tiers: LandingTierRecord[];
}
