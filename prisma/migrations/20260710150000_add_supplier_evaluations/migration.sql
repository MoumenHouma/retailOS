-- Phase 5 Chunk C: Supplier Ranking (MCDA) — supplier_evaluations per
-- DATABASE.md §12.1 verbatim, evaluation_method_enum per §14.

-- CreateEnum
CREATE TYPE "evaluation_method_enum" AS ENUM ('ahp_topsis', 'ahp_promethee', 'ahp_only', 'topsis_only');

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "supplier_id" UUID NOT NULL,
    "evaluation_period" VARCHAR(50) NOT NULL,
    "method" "evaluation_method_enum" NOT NULL,
    "criteria_weights" JSONB NOT NULL,
    "supplier_scores" JSONB NOT NULL,
    "consistency_ratio" DECIMAL(5,4),
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_by" UUID NOT NULL,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_evaluations_tenant_id_idx" ON "supplier_evaluations"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplier_id_idx" ON "supplier_evaluations"("supplier_id");

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_evaluated_by_fkey" FOREIGN KEY ("evaluated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "supplier_evaluations" TO app_user;

-- Row-Level Security
ALTER TABLE "supplier_evaluations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "supplier_evaluations"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
