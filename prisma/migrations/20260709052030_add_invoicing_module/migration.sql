-- CreateEnum
CREATE TYPE "invoice_status_enum" AS ENUM ('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled');

-- CreateTable
CREATE TABLE "invoice_sequences" (
    "tenant_id" UUID NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "invoice_number" VARCHAR(20) NOT NULL,
    "sale_id" UUID,
    "customer_id" UUID,
    "customer_name" VARCHAR(500),
    "customer_address" TEXT,
    "customer_nif" VARCHAR(20),
    "issue_date" DATE NOT NULL,
    "due_date" DATE,
    "subtotal" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tva_amount" INTEGER NOT NULL,
    "tva_details" JSONB NOT NULL,
    "tax_stamp_amount" INTEGER NOT NULL,
    "total_ttc" INTEGER NOT NULL,
    "net_to_pay" INTEGER NOT NULL,
    "amount_in_words" TEXT NOT NULL,
    "payment_terms" TEXT,
    "status" "invoice_status_enum" NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "pdf_url" VARCHAR(500),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_id" UUID,
    "description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "tva_rate" SMALLINT NOT NULL,
    "amount_ht" INTEGER NOT NULL,
    "tva_amount" INTEGER NOT NULL,
    "amount_ttc" INTEGER NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_sale_id_idx" ON "invoices"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_tenant_id_idx" ON "invoice_items"("tenant_id");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_sequences", "invoices", "invoice_items" TO app_user;

-- Row-Level Security (each table has its own tenant_id column directly — no join-based policy needed)
ALTER TABLE "invoice_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "invoice_sequences"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "invoices"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenant_isolation" ON "invoice_items"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
