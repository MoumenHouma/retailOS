-- CreateEnum
CREATE TYPE "customer_type_enum" AS ENUM ('walk_in', 'regular', 'vip', 'wholesale');

-- CreateEnum
CREATE TYPE "pos_session_status_enum" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "cash_movement_type_enum" AS ENUM ('OPENING', 'CLOSING', 'WITHDRAWAL', 'DEPOSIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "sale_status_enum" AS ENUM ('completed', 'voided', 'held');

-- CreateEnum
CREATE TYPE "payment_method_enum" AS ENUM ('CASH', 'CARD', 'CHECK', 'TRANSFER', 'MIXED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "sale_counter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "name" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(20),
    "customer_type" "customer_type_enum" NOT NULL DEFAULT 'walk_in',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "terminal_name" VARCHAR(50) NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opening_cash" INTEGER NOT NULL,
    "closing_cash" INTEGER,
    "expected_cash" INTEGER,
    "cash_difference" INTEGER,
    "total_sales" INTEGER NOT NULL DEFAULT 0,
    "total_refunds" INTEGER NOT NULL DEFAULT 0,
    "status" "pos_session_status_enum" NOT NULL DEFAULT 'open',

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_cash_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "session_id" UUID NOT NULL,
    "movement_type" "cash_movement_type_enum" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID NOT NULL,
    "sale_number" VARCHAR(50) NOT NULL,
    "pos_session_id" UUID,
    "customer_id" UUID,
    "cashier_id" UUID NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tva_amount" INTEGER NOT NULL,
    "tax_stamp_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "total_paid" INTEGER NOT NULL,
    "change_due" INTEGER NOT NULL DEFAULT 0,
    "status" "sale_status_enum" NOT NULL DEFAULT 'completed',
    "is_offline" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "product_barcode" VARCHAR(20),
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "cost_price" INTEGER,
    "tva_rate" SMALLINT NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    "tva_amount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "batch_id" UUID,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "sale_id" UUID NOT NULL,
    "payment_method" "payment_method_enum" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "pos_sessions_tenant_id_idx" ON "pos_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "pos_sessions_store_id_idx" ON "pos_sessions"("store_id");

-- CreateIndex
CREATE INDEX "pos_sessions_cashier_id_idx" ON "pos_sessions"("cashier_id");

-- CreateIndex
CREATE INDEX "pos_cash_movements_tenant_id_idx" ON "pos_cash_movements"("tenant_id");

-- CreateIndex
CREATE INDEX "pos_cash_movements_session_id_idx" ON "pos_cash_movements"("session_id");

-- CreateIndex
CREATE INDEX "sales_tenant_id_idx" ON "sales"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_store_id_idx" ON "sales"("store_id");

-- CreateIndex
CREATE INDEX "sales_cashier_id_idx" ON "sales"("cashier_id");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_tenant_id_store_id_sale_number_key" ON "sales"("tenant_id", "store_id", "sale_number");

-- CreateIndex
CREATE INDEX "sale_items_tenant_id_idx" ON "sale_items"("tenant_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sale_payments_tenant_id_idx" ON "sale_payments"("tenant_id");

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_pos_session_id_fkey" FOREIGN KEY ("pos_session_id") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "customers", "pos_sessions", "pos_cash_movements", "sales", "sale_items", "sale_payments" TO app_user;

-- Row-Level Security (each table has its own tenant_id column directly — no join-based policy needed)
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pos_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pos_cash_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "customers"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "pos_sessions"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "pos_cash_movements"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "sales"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "sale_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "sale_payments"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
