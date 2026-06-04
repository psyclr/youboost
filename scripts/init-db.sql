-- Инициализация БД youboost

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID генерация
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Криптография

-- Комментарий
COMMENT ON DATABASE youboost_dev IS 'youboost SMM Marketplace Development Database';

-- Создание тестовой БД
SELECT 'CREATE DATABASE youboost_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'youboost_test')\gexec

-- Базовая схема будет создана через migrations
-- Schema changes are tracked in prisma/migrations/ and applied via: prisma migrate deploy
--
-- Migration 20260529071443_add_payment_and_order_payment_link DDL reference:
--
-- CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
--
-- DROP INDEX "orders_stripe_session_id_key";
--
-- ALTER TABLE "orders"
--   DROP COLUMN "stripe_session_id",
--   ADD COLUMN "payment_id" UUID;
--
-- CREATE TABLE "payments" (
--     "id" UUID NOT NULL,
--     "user_id" UUID NOT NULL,
--     "amount" DECIMAL(12,2) NOT NULL,
--     "provider" VARCHAR(32) NOT NULL,
--     "provider_session_id" VARCHAR(255),
--     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
--     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "paid_at" TIMESTAMPTZ(6),
--     CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
-- );
--
-- CREATE UNIQUE INDEX "payments_provider_session_id_key" ON "payments"("provider_session_id");
-- CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");
-- CREATE INDEX "orders_payment_id_idx" ON "orders"("payment_id");
--
-- ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_id_fkey"
--   FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey"
--   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
