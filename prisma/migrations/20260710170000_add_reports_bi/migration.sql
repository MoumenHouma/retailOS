-- Phase 6 Chunk A: Reports & BI — scheduled_reports, dashboard_layouts.
-- Net-new schema, undocumented in ARCHITECTURE.md/DATABASE.md beyond a
-- report-name list (see PHASE6_POLISH_LAUNCH_PLAN.md doc-trust note).

-- CreateEnum
CREATE TYPE "report_type_enum" AS ENUM ('sales', 'inventory', 'purchase', 'financial', 'employee');

-- CreateEnum
CREATE TYPE "report_export_format_enum" AS ENUM ('pdf', 'xlsx', 'csv');

-- CreateEnum
CREATE TYPE "report_frequency_enum" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "report_run_status_enum" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "report_type" "report_type_enum" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "format" "report_export_format_enum" NOT NULL,
    "frequency" "report_frequency_enum" NOT NULL,
    "recipient_emails" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_run_status" "report_run_status_enum",
    "last_run_error" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "role" VARCHAR(50) NOT NULL,
    "widgets" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_idx" ON "scheduled_reports"("tenant_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_is_active_idx" ON "scheduled_reports"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_tenant_id_role_key" ON "dashboard_layouts"("tenant_id", "role");

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "scheduled_reports" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "dashboard_layouts" TO app_user;

-- Row-Level Security
ALTER TABLE "scheduled_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "scheduled_reports"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "tenant_isolation" ON "dashboard_layouts"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
