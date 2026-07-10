-- Phase 4 Chunk B: Customer Management (extended Customer columns, loyalty
-- ledger, customer debt tracking, customer-specific pricing).

-- CreateEnum
CREATE TYPE "debt_status_enum" AS ENUM ('outstanding', 'partially_paid', 'paid', 'written_off');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "credit_limit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_debt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "last_visit_at" TIMESTAMP(3),
ADD COLUMN     "loyalty_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nif" VARCHAR(20),
ADD COLUMN     "total_purchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_spent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visit_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "loyalty_point_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "customer_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_debts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "customer_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "sale_id" UUID,
    "due_date" DATE,
    "status" "debt_status_enum" NOT NULL DEFAULT 'outstanding',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_debt_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "debt_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_method" "payment_method_enum" NOT NULL,
    "reference" VARCHAR(100),
    "paid_at" TIMESTAMP(3) NOT NULL,
    "recorded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_prices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "customer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyalty_point_transactions_tenant_id_idx" ON "loyalty_point_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_point_transactions_customer_id_idx" ON "loyalty_point_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "customer_debts_tenant_id_idx" ON "customer_debts"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_debts_customer_id_idx" ON "customer_debts"("customer_id");

-- CreateIndex
CREATE INDEX "customer_debt_payments_tenant_id_idx" ON "customer_debt_payments"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_debt_payments_debt_id_idx" ON "customer_debt_payments"("debt_id");

-- CreateIndex
CREATE INDEX "customer_prices_tenant_id_idx" ON "customer_prices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_prices_tenant_id_customer_id_product_id_key" ON "customer_prices"("tenant_id", "customer_id", "product_id");

-- AddForeignKey
ALTER TABLE "loyalty_point_transactions" ADD CONSTRAINT "loyalty_point_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_point_transactions" ADD CONSTRAINT "loyalty_point_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debts" ADD CONSTRAINT "customer_debts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debts" ADD CONSTRAINT "customer_debts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debts" ADD CONSTRAINT "customer_debts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debt_payments" ADD CONSTRAINT "customer_debt_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debt_payments" ADD CONSTRAINT "customer_debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "customer_debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_debt_payments" ADD CONSTRAINT "customer_debt_payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_prices" ADD CONSTRAINT "customer_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "loyalty_point_transactions", "customer_debts", "customer_debt_payments", "customer_prices" TO app_user;

-- Row-Level Security (each table has its own tenant_id column directly — no join-based policy needed)
ALTER TABLE "loyalty_point_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_debt_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_prices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "loyalty_point_transactions"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "customer_debts"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "customer_debt_payments"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "customer_prices"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
