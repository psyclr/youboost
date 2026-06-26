-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogTone" AS ENUM ('PROFESSIONAL', 'CASUAL', 'EXPERT');

-- CreateEnum
CREATE TYPE "BlogPlanTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- CreateEnum
CREATE TYPE "KeywordSource" AS ENUM ('AI', 'DATAFORSEO', 'MANUAL');

-- CreateTable
CREATE TABLE "blog_sites" (
    "id" UUID NOT NULL,
    "api_key" VARCHAR(64) NOT NULL,
    "subdomain" VARCHAR(64) NOT NULL,
    "domain" VARCHAR(255),
    "domain_verified" BOOLEAN NOT NULL DEFAULT false,
    "verify_token" VARCHAR(64) NOT NULL,
    "owner_email" VARCHAR(255) NOT NULL,
    "business_description" TEXT NOT NULL,
    "target_audience" VARCHAR(255),
    "tone" "BlogTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "posts_per_week" INTEGER NOT NULL DEFAULT 3,
    "default_language" VARCHAR(5) NOT NULL DEFAULT 'ru',
    "topics" TEXT[],
    "claude_model" VARCHAR(64) NOT NULL DEFAULT 'claude-sonnet-4-6',
    "auto_publish" BOOLEAN NOT NULL DEFAULT false,
    "branding" JSONB,
    "unsplash_api_key" TEXT,
    "llm_provider" "LlmProvider" NOT NULL DEFAULT 'ANTHROPIC',
    "llm_credential" TEXT,
    "llm_model" VARCHAR(64),
    "plan_tier" "BlogPlanTier" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(320) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "target_keyword" VARCHAR(255),
    "secondary_keywords" TEXT[],
    "author" VARCHAR(100) NOT NULL,
    "cover_image_url" VARCHAR(512),
    "cover_image_alt" VARCHAR(255),
    "published_at" TIMESTAMPTZ(6),
    "reading_time_min" INTEGER,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_keywords" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "volume_est" INTEGER,
    "difficulty" INTEGER,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "source" "KeywordSource" NOT NULL DEFAULT 'AI',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_usage" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "posts_generated" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "blog_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_sites_api_key_key" ON "blog_sites"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "blog_sites_subdomain_key" ON "blog_sites"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "blog_sites_domain_key" ON "blog_sites"("domain");

-- CreateIndex
CREATE INDEX "blog_sites_api_key_idx" ON "blog_sites"("api_key");

-- CreateIndex
CREATE INDEX "blog_sites_domain_idx" ON "blog_sites"("domain");

-- CreateIndex
CREATE INDEX "blog_posts_site_id_status_published_at_idx" ON "blog_posts"("site_id", "status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_site_id_slug_key" ON "blog_posts"("site_id", "slug");

-- CreateIndex
CREATE INDEX "blog_keywords_site_id_used_difficulty_idx" ON "blog_keywords"("site_id", "used", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "blog_keywords_site_id_keyword_key" ON "blog_keywords"("site_id", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "blog_usage_site_id_month_key" ON "blog_usage"("site_id", "month");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "blog_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_keywords" ADD CONSTRAINT "blog_keywords_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "blog_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_usage" ADD CONSTRAINT "blog_usage_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "blog_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
