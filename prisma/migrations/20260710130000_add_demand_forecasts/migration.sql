-- Phase 5 Chunk A: AI Engine Setup & Forecasting — demand_forecasts per
-- DATABASE.md §12.2 verbatim.

-- CreateTable
CREATE TABLE "demand_forecasts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "product_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "forecast_date" DATE NOT NULL,
    "predicted_quantity" INTEGER NOT NULL,
    "predicted_lower" INTEGER,
    "predicted_upper" INTEGER,
    "model_used" VARCHAR(50) NOT NULL,
    "model_version" VARCHAR(50),
    "accuracy_mape" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demand_forecasts_tenant_id_idx" ON "demand_forecasts"("tenant_id");

-- CreateIndex
CREATE INDEX "demand_forecasts_product_id_idx" ON "demand_forecasts"("product_id");

-- CreateIndex
CREATE INDEX "demand_forecasts_store_id_idx" ON "demand_forecasts"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "demand_forecasts_tenant_id_product_id_store_id_forecast_d_key" ON "demand_forecasts"("tenant_id", "product_id", "store_id", "forecast_date");

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "demand_forecasts" TO app_user;

-- Row-Level Security
ALTER TABLE "demand_forecasts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "demand_forecasts"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
