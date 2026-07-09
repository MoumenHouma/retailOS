-- CreateEnum
CREATE TYPE "transfer_status_enum" AS ENUM ('draft', 'pending', 'in_transit', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "count_status_enum" AS ENUM ('in_progress', 'pending_review', 'approved', 'cancelled');

-- CreateEnum
CREATE TYPE "adjustment_status_enum" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "bin_id" UUID;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "count_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "transfer_counter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "transfer_number" VARCHAR(50) NOT NULL,
    "from_store_id" UUID NOT NULL,
    "to_store_id" UUID NOT NULL,
    "status" "transfer_status_enum" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,
    "received_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "transfer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_sent" INTEGER NOT NULL DEFAULT 0,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID NOT NULL,
    "count_number" VARCHAR(50) NOT NULL,
    "status" "count_status_enum" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" UUID,
    "approved_by" UUID,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- `difference` is Postgres GENERATED ALWAYS AS (...) STORED — Prisma has no
-- syntax for this, same "hand-append what Prisma can't express" pattern
-- already used for stock_levels.quantity_available.
CREATE TABLE "stock_count_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "system_quantity" INTEGER NOT NULL,
    "counted_quantity" INTEGER NOT NULL,
    "difference" INTEGER GENERATED ALWAYS AS ("counted_quantity" - "system_quantity") STORED,
    "adjustment_status" "adjustment_status_enum" NOT NULL DEFAULT 'pending',

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "warehouse_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "zone_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_transfers_tenant_id_idx" ON "stock_transfers"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_transfers_from_store_id_idx" ON "stock_transfers"("from_store_id");

-- CreateIndex
CREATE INDEX "stock_transfers_to_store_id_idx" ON "stock_transfers"("to_store_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_tenant_id_transfer_number_key" ON "stock_transfers"("tenant_id", "transfer_number");

-- CreateIndex
CREATE INDEX "stock_transfer_items_tenant_id_idx" ON "stock_transfer_items"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transfer_id_idx" ON "stock_transfer_items"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_transfer_items_product_id_idx" ON "stock_transfer_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_counts_tenant_id_idx" ON "stock_counts"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_counts_store_id_idx" ON "stock_counts"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_tenant_id_count_number_key" ON "stock_counts"("tenant_id", "count_number");

-- CreateIndex
CREATE INDEX "stock_count_items_tenant_id_idx" ON "stock_count_items"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_count_items_count_id_idx" ON "stock_count_items"("count_id");

-- CreateIndex
CREATE INDEX "stock_count_items_product_id_idx" ON "stock_count_items"("product_id");

-- CreateIndex
CREATE INDEX "warehouses_tenant_id_idx" ON "warehouses"("tenant_id");

-- CreateIndex
CREATE INDEX "warehouses_store_id_idx" ON "warehouses"("store_id");

-- CreateIndex
CREATE INDEX "warehouse_zones_tenant_id_idx" ON "warehouse_zones"("tenant_id");

-- CreateIndex
CREATE INDEX "warehouse_zones_warehouse_id_idx" ON "warehouse_zones"("warehouse_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_tenant_id_idx" ON "warehouse_bins"("tenant_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_zone_id_idx" ON "warehouse_bins"("zone_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_store_id_fkey" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_store_id_fkey" FOREIGN KEY ("to_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "stock_transfers", "stock_transfer_items", "stock_counts", "stock_count_items", "warehouses", "warehouse_zones", "warehouse_bins" TO app_user;

-- Row-Level Security (each table has its own tenant_id column directly — no join-based policy needed)
ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfer_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_counts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_count_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_bins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "stock_transfers"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "stock_transfer_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "stock_counts"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "stock_count_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "warehouses"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "warehouse_zones"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "warehouse_bins"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
