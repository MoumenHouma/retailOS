-- Phase 5 Chunk B: Inventory Optimization — ai_recommendations per
-- DATABASE.md §12.3 verbatim, plus recommendation_type_enum/priority_enum
-- per §14. Also doubles as the in-app AI notification store (is_read/
-- is_actioned) — no separate Notification table.

-- CreateEnum
CREATE TYPE "recommendation_type_enum" AS ENUM ('reorder', 'supplier_switch', 'price_change', 'markdown', 'promotion', 'staffing', 'waste_prevention');

-- CreateEnum
CREATE TYPE "priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "store_id" UUID,
    "recommendation_type" "recommendation_type_enum" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "priority" "priority_enum" NOT NULL DEFAULT 'medium',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_actioned" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_recommendations_tenant_id_idx" ON "ai_recommendations"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_recommendations_tenant_id_is_read_idx" ON "ai_recommendations"("tenant_id", "is_read");

-- CreateIndex
CREATE INDEX "ai_recommendations_store_id_idx" ON "ai_recommendations"("store_id");

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_recommendations" TO app_user;

-- Row-Level Security
ALTER TABLE "ai_recommendations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "ai_recommendations"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
