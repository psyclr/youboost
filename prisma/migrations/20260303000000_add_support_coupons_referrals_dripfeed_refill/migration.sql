-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CRYPTO', 'STRIPE');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "ReferralBonusStatus" AS ENUM ('PENDING', 'CREDITED');
CREATE TYPE "EmailTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- AlterTable: users (referral fields)
ALTER TABLE "users" ADD COLUMN "referral_code" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "referred_by_id" UUID;
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX "users_referral_code_idx" ON "users"("referral_code");

-- AlterTable: services (refill)
ALTER TABLE "services" ADD COLUMN "refill_days" INTEGER;

-- AlterTable: orders (drip-feed, refill, coupon)
ALTER TABLE "orders" ADD COLUMN "is_drip_feed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "drip_feed_runs" INTEGER;
ALTER TABLE "orders" ADD COLUMN "drip_feed_interval" INTEGER;
ALTER TABLE "orders" ADD COLUMN "drip_feed_runs_completed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "refill_eligible_until" TIMESTAMPTZ(6);
ALTER TABLE "orders" ADD COLUMN "refill_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "coupon_id" UUID;
ALTER TABLE "orders" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
CREATE INDEX "orders_is_drip_feed_idx" ON "orders"("is_drip_feed");

-- AlterTable: deposits (payment method, stripe)
ALTER TABLE "deposits" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CRYPTO';
ALTER TABLE "deposits" ADD COLUMN "stripe_session_id" VARCHAR(255);
ALTER TABLE "deposits" ALTER COLUMN "crypto_amount" SET DEFAULT 0;
ALTER TABLE "deposits" ALTER COLUMN "crypto_currency" SET DEFAULT '';
ALTER TABLE "deposits" ALTER COLUMN "payment_address" SET DEFAULT '';
CREATE UNIQUE INDEX "deposits_stripe_session_id_key" ON "deposits"("stripe_session_id");

-- CreateTable: support_tickets
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at" DESC);

-- CreateTable: ticket_messages
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");
CREATE INDEX "ticket_messages_created_at_idx" ON "ticket_messages"("created_at");

-- CreateTable: coupons
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "min_order_amount" DECIMAL(10,2),
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_code_idx" ON "coupons"("code");
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");

-- CreateTable: referral_bonuses
CREATE TABLE "referral_bonuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ReferralBonusStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "referral_bonuses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "referral_bonuses_referrer_id_idx" ON "referral_bonuses"("referrer_id");
CREATE INDEX "referral_bonuses_referred_id_idx" ON "referral_bonuses"("referred_id");

-- CreateTable: email_tokens
CREATE TABLE "email_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "type" "EmailTokenType" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens"("token_hash");
CREATE INDEX "email_tokens_token_hash_idx" ON "email_tokens"("token_hash");
CREATE INDEX "email_tokens_user_id_idx" ON "email_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referral_bonuses" ADD CONSTRAINT "referral_bonuses_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "referral_bonuses" ADD CONSTRAINT "referral_bonuses_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
