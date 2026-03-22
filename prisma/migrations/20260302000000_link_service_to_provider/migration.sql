-- AlterTable
ALTER TABLE "services" ADD COLUMN "provider_id" UUID,
ADD COLUMN "external_service_id" VARCHAR(255);

-- CreateIndex
CREATE INDEX "services_provider_id_idx" ON "services"("provider_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
