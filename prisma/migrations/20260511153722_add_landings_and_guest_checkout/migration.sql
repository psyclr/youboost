-- =====================================================================
-- Landings + guest checkout
-- =====================================================================
-- Adds:
--   - User.is_auto_created flag for auto-created accounts from guest checkout
--   - Order.stripe_session_id (+ unique index) for one-shot Stripe sessions
--   - OrderStatus.PENDING_PAYMENT for orders awaiting Stripe confirmation
--   - EmailTokenType.AUTO_USER_SETUP for set-password links sent to guests
--   - Landing, LandingTier models + LandingStatus / LandingTierPill / LandingTierGlow enums

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT' AFTER 'PENDING';

-- AlterEnum
ALTER TYPE "EmailTokenType" ADD VALUE 'AUTO_USER_SETUP';

-- CreateEnum
CREATE TYPE "LandingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LandingTierPill" AS ENUM ('SALE', 'MEGA_FAST', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LandingTierGlow" AS ENUM ('ORANGE', 'COSMIC', 'PURPLE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_auto_created" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "stripe_session_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_session_id_key" ON "orders"("stripe_session_id");

-- CreateTable
CREATE TABLE "landings" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "status" "LandingStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_title" VARCHAR(160) NOT NULL,
    "seo_description" VARCHAR(320) NOT NULL,
    "seo_og_image_url" VARCHAR(512),
    "hero_eyebrow" VARCHAR(120),
    "hero_title" VARCHAR(160) NOT NULL,
    "hero_accent" VARCHAR(160),
    "hero_lead" VARCHAR(500) NOT NULL,
    "hero_placeholder" VARCHAR(160) NOT NULL,
    "hero_cta_label" VARCHAR(32) NOT NULL DEFAULT 'GO!',
    "hero_fineprint" VARCHAR(160),
    "hero_min_amount" DECIMAL(10,2) NOT NULL DEFAULT 4,
    "default_service_id" UUID,
    "stats" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "faq" JSONB NOT NULL,
    "footer_cta" JSONB,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "landings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landings_slug_key" ON "landings"("slug");

-- CreateIndex
CREATE INDEX "landings_status_slug_idx" ON "landings"("status", "slug");

-- CreateTable
CREATE TABLE "landing_tiers" (
    "id" UUID NOT NULL,
    "landing_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "pill_kind" "LandingTierPill",
    "glow_kind" "LandingTierGlow",
    "title_override" VARCHAR(160),
    "desc_override" VARCHAR(320),
    "price_override" DECIMAL(10,4),
    "unit" VARCHAR(16) NOT NULL DEFAULT '1k',

    CONSTRAINT "landing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_tiers_landing_id_order_key" ON "landing_tiers"("landing_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "landing_tiers_landing_id_service_id_key" ON "landing_tiers"("landing_id", "service_id");

-- AddForeignKey
ALTER TABLE "landing_tiers" ADD CONSTRAINT "landing_tiers_landing_id_fkey" FOREIGN KEY ("landing_id") REFERENCES "landings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_tiers" ADD CONSTRAINT "landing_tiers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
