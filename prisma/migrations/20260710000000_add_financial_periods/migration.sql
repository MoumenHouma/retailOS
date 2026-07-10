-- Phase 4 Chunk C: Advanced Financial Reports (FinancialPeriod — the only
-- new table this chunk needs; balance sheet/cash flow/tax report/expense
-- analysis/margin analysis are all pure read-time aggregation over
-- already-shipped tables).

-- CreateEnum
CREATE TYPE "period_status_enum" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "period_status_enum" NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_periods_tenant_id_idx" ON "financial_periods"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_tenant_id_name_key" ON "financial_periods"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "financial_periods" TO app_user;

-- Row-Level Security
ALTER TABLE "financial_periods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "financial_periods"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
