-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CRYPTOMUS';

-- AlterTable
ALTER TABLE "deposits" ADD COLUMN "cryptomus_order_id" VARCHAR(255),
ADD COLUMN "cryptomus_checkout_url" VARCHAR(512);

-- CreateIndex
CREATE UNIQUE INDEX "deposits_cryptomus_order_id_key" ON "deposits"("cryptomus_order_id");
