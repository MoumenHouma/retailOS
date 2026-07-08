-- CreateEnum
CREATE TYPE "stock_movement_type_enum" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'WRITE_OFF');

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "movement_type" "stock_movement_type_enum" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_id" UUID,
    "reference_type" VARCHAR(50),
    "batch_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "quantity_available" INTEGER GENERATED ALWAYS AS ("quantity_on_hand" - "quantity_reserved") STORED,
    "last_movement_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_idx" ON "stock_movements"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "stock_movements_store_id_idx" ON "stock_movements"("store_id");

-- CreateIndex
CREATE INDEX "stock_movements_movement_type_idx" ON "stock_movements"("movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_store_id_created_at_idx" ON "stock_movements"("product_id", "store_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_tenant_id_product_id_store_id_key" ON "stock_levels"("tenant_id", "product_id", "store_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_positive_check" CHECK ("quantity" > 0);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "stock_movements", "stock_levels" TO app_user;

-- Row-Level Security
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "stock_movements"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "stock_levels"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Trigger: the only path by which stock_levels is ever written. Runs under
-- the invoking role's privileges (no SECURITY DEFINER) — app.current_tenant_id
-- is already SET LOCAL for the whole transaction via withTenant(), and
-- NEW.tenant_id matches it, so the stock_levels write satisfies that table's
-- own tenant_isolation policy automatically.
CREATE OR REPLACE FUNCTION fn_apply_stock_movement() RETURNS TRIGGER AS $$
DECLARE
  v_direction INT;
  v_resulting_qty INT;
BEGIN
  v_direction := CASE NEW.movement_type
    WHEN 'PURCHASE_IN'    THEN 1
    WHEN 'TRANSFER_IN'    THEN 1
    WHEN 'ADJUSTMENT_IN'  THEN 1
    WHEN 'RETURN_IN'      THEN 1
    WHEN 'SALE_OUT'       THEN -1
    WHEN 'TRANSFER_OUT'   THEN -1
    WHEN 'ADJUSTMENT_OUT' THEN -1
    WHEN 'RETURN_OUT'     THEN -1
    WHEN 'WRITE_OFF'      THEN -1
    ELSE NULL
  END;

  IF v_direction IS NULL THEN
    RAISE EXCEPTION 'Unknown stock_movement_type: %', NEW.movement_type;
  END IF;

  INSERT INTO stock_levels (id, tenant_id, product_id, store_id, quantity_on_hand, quantity_reserved, last_movement_at, updated_at)
  VALUES (gen_random_uuid(), NEW.tenant_id, NEW.product_id, NEW.store_id, v_direction * NEW.quantity, 0, NEW.created_at, now())
  ON CONFLICT (tenant_id, product_id, store_id)
  DO UPDATE SET
    quantity_on_hand = stock_levels.quantity_on_hand + v_direction * NEW.quantity,
    last_movement_at = NEW.created_at,
    updated_at = now();

  SELECT quantity_on_hand INTO v_resulting_qty
  FROM stock_levels
  WHERE tenant_id = NEW.tenant_id AND product_id = NEW.product_id AND store_id = NEW.store_id;

  IF v_resulting_qty < 0 THEN
    RAISE EXCEPTION 'Stock movement would result in negative on-hand quantity (product %, store %, resulting %)',
      NEW.product_id, NEW.store_id, v_resulting_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movements_apply
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_apply_stock_movement();
