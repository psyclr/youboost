-- AlterTable
ALTER TABLE "payments" ADD COLUMN "metrika_client_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "deposits" ADD COLUMN "metrika_client_id" VARCHAR(64);
