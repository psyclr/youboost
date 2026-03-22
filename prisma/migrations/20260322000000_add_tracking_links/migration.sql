-- CreateTable
CREATE TABLE "tracking_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_links_code_key" ON "tracking_links"("code");

-- CreateIndex
CREATE INDEX "tracking_links_code_idx" ON "tracking_links"("code");
