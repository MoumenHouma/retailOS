-- CreateTable
CREATE TABLE "purchase_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "po_id" UUID NOT NULL,
    "delivery_number" VARCHAR(50) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "received_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_delivery_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "delivery_id" UUID NOT NULL,
    "po_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_delivered" INTEGER NOT NULL,
    "batch_number" VARCHAR(100),
    "expiration_date" DATE,
    "unit_cost" INTEGER,

    CONSTRAINT "purchase_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "product_id" UUID NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "manufacturing_date" DATE,
    "expiration_date" DATE,
    "quantity_received" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "unit_cost" INTEGER,
    "supplier_id" UUID,
    "store_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_batches_quantity_remaining_check" CHECK ("quantity_remaining" >= 0)
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "original_delivery_id" UUID NOT NULL,
    "return_number" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "total_refunded" INTEGER NOT NULL,
    "status" "return_status_enum" NOT NULL DEFAULT 'completed',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "return_id" UUID NOT NULL,
    "delivery_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_deliveries_tenant_id_idx" ON "purchase_deliveries"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_deliveries_po_id_idx" ON "purchase_deliveries"("po_id");

-- CreateIndex
CREATE INDEX "purchase_delivery_items_tenant_id_idx" ON "purchase_delivery_items"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_delivery_items_delivery_id_idx" ON "purchase_delivery_items"("delivery_id");

-- CreateIndex
CREATE INDEX "purchase_delivery_items_po_item_id_idx" ON "purchase_delivery_items"("po_item_id");

-- CreateIndex
CREATE INDEX "product_batches_tenant_id_idx" ON "product_batches"("tenant_id");

-- CreateIndex
CREATE INDEX "product_batches_product_id_idx" ON "product_batches"("product_id");

-- CreateIndex
CREATE INDEX "purchase_returns_tenant_id_idx" ON "purchase_returns"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_returns_store_id_idx" ON "purchase_returns"("store_id");

-- CreateIndex
CREATE INDEX "purchase_returns_original_delivery_id_idx" ON "purchase_returns"("original_delivery_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_tenant_id_idx" ON "purchase_return_items"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_return_id_idx" ON "purchase_return_items"("return_id");

-- CreateIndex
CREATE INDEX "purchase_return_items_delivery_item_id_idx" ON "purchase_return_items"("delivery_item_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_deliveries" ADD CONSTRAINT "purchase_deliveries_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_delivery_items" ADD CONSTRAINT "purchase_delivery_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_delivery_items" ADD CONSTRAINT "purchase_delivery_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "purchase_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_delivery_items" ADD CONSTRAINT "purchase_delivery_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_delivery_items" ADD CONSTRAINT "purchase_delivery_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_original_delivery_id_fkey" FOREIGN KEY ("original_delivery_id") REFERENCES "purchase_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "purchase_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_delivery_item_id_fkey" FOREIGN KEY ("delivery_item_id") REFERENCES "purchase_delivery_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "purchase_deliveries", "purchase_delivery_items", "product_batches", "purchase_returns", "purchase_return_items" TO app_user;

-- Row-Level Security (each table has its own tenant_id column directly — no join-based policy needed)
ALTER TABLE "purchase_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_delivery_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_return_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "purchase_deliveries"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "purchase_delivery_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "product_batches"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "purchase_returns"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "purchase_return_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
