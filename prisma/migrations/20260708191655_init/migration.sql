-- CreateEnum
CREATE TYPE "subscription_status_enum" AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "logo_url" VARCHAR(500),
    "nif" VARCHAR(20) NOT NULL,
    "nis" VARCHAR(20) NOT NULL,
    "rc" VARCHAR(30) NOT NULL,
    "ai" VARCHAR(30),
    "forme_juridique" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(100),
    "wilaya" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "website" VARCHAR(500),
    "activity_sector" VARCHAR(100),
    "tva_default_rate" SMALLINT NOT NULL DEFAULT 19,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'DZD',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'fr-DZ',
    "subscription_plan" VARCHAR(50) NOT NULL DEFAULT 'starter',
    "subscription_status" "subscription_status_enum" NOT NULL DEFAULT 'active',
    "subscription_ends_at" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "wilaya" VARCHAR(100),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "pos_prefix" VARCHAR(5) NOT NULL DEFAULT 'POS',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "store_id" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stores" (
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,

    CONSTRAINT "user_stores_pkey" PRIMARY KEY ("user_id","store_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_nif_key" ON "tenants"("nif");

-- CreateIndex
CREATE INDEX "stores_tenant_id_idx" ON "stores"("tenant_id");

-- CreateIndex
CREATE INDEX "stores_tenant_id_is_main_idx" ON "stores"("tenant_id", "is_main");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_store_id_key" ON "user_roles"("user_id", "role_id", "store_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extensions (DATABASE.md §2)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- CHECK constraints Prisma has no native syntax for
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_nif_format" CHECK ("nif" ~ '^[A-Za-z0-9]{15}$');
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tva_rate" CHECK ("tva_default_rate" IN (0, 9, 19));

-- Default GUC value so current_setting('app.current_tenant_id') is never
-- literally unset on a fresh connection (DATABASE.md §3). RLS policies below
-- still use the missing_ok=true form as a second line of defense.
ALTER DATABASE retailos SET app.current_tenant_id = '';

-- Grant table/sequence privileges to the RLS-restricted runtime role.
-- (docker/postgres/init/01-roles.sql's ALTER DEFAULT PRIVILEGES only covers
-- tables created *after* it ran, so tables from this first migration need an
-- explicit grant here.)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Row-Level Security: enable on every tenant-scoped table. `tenants` and
-- `permissions` are platform-level (no tenant_id column) and are
-- deliberately left without RLS — see ARCHITECTURE.md §2 / DATABASE.md §3.
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_stores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "stores"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_isolation" ON "users"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_isolation" ON "roles"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

-- Junction tables have no tenant_id column of their own — scope them via a
-- join back to a table that does.
CREATE POLICY "tenant_isolation" ON "role_permissions"
  USING ("role_id" IN (SELECT "id" FROM "roles" WHERE "tenant_id" = current_setting('app.current_tenant_id', true)::uuid));
CREATE POLICY "tenant_isolation" ON "user_roles"
  USING ("user_id" IN (SELECT "id" FROM "users" WHERE "tenant_id" = current_setting('app.current_tenant_id', true)::uuid));
CREATE POLICY "tenant_isolation" ON "user_stores"
  USING ("user_id" IN (SELECT "id" FROM "users" WHERE "tenant_id" = current_setting('app.current_tenant_id', true)::uuid));
