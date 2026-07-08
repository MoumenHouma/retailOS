-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "product_barcodes" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "product_categories" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "stock_levels" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "supplier_contacts" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "supplier_products" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;

-- AlterTable
ALTER TABLE "units" ALTER COLUMN "tenant_id" SET DEFAULT NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid;
