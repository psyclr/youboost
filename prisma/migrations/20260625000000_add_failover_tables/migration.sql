CREATE TABLE "service_provider_mappings" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "external_service_id" VARCHAR(255) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "provider_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_provider_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_provider_mappings_service_id_provider_id_key" ON "service_provider_mappings"("service_id","provider_id");
CREATE INDEX "service_provider_mappings_service_id_priority_idx" ON "service_provider_mappings"("service_id","priority");
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_order_attempts" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "external_service_id" VARCHAR(255) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "error" TEXT,
  "provider_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_order_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "provider_order_attempts_order_id_idx" ON "provider_order_attempts"("order_id");
CREATE INDEX "provider_order_attempts_provider_id_outcome_idx" ON "provider_order_attempts"("provider_id","outcome");
ALTER TABLE "provider_order_attempts" ADD CONSTRAINT "provider_order_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_order_attempts" ADD CONSTRAINT "provider_order_attempts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "service_provider_mappings" ("id","service_id","provider_id","external_service_id","priority","is_active")
SELECT gen_random_uuid(), s."id", s."provider_id", s."external_service_id", 0, true
FROM "services" s
WHERE s."provider_id" IS NOT NULL AND s."external_service_id" IS NOT NULL;
