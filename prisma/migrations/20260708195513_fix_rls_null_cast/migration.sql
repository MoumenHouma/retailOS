-- The initial RLS policies cast current_setting('app.current_tenant_id', true)
-- directly to ::uuid. When the GUC is set to '' (its database-level default —
-- see the ALTER DATABASE in the init migration), casting '' to uuid throws a
-- hard Postgres error (22P02) instead of failing closed. NULLIF converts the
-- empty string to NULL first, so the comparison becomes `tenant_id = NULL`
-- (unknown/false) rather than erroring — the correct fail-closed behavior.

DROP POLICY "tenant_isolation" ON "stores";
CREATE POLICY "tenant_isolation" ON "stores"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "users";
CREATE POLICY "tenant_isolation" ON "users"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "roles";
CREATE POLICY "tenant_isolation" ON "roles"
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "role_permissions";
CREATE POLICY "tenant_isolation" ON "role_permissions"
  USING ("role_id" IN (SELECT "id" FROM "roles" WHERE "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY "tenant_isolation" ON "user_roles";
CREATE POLICY "tenant_isolation" ON "user_roles"
  USING ("user_id" IN (SELECT "id" FROM "users" WHERE "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY "tenant_isolation" ON "user_stores";
CREATE POLICY "tenant_isolation" ON "user_stores"
  USING ("user_id" IN (SELECT "id" FROM "users" WHERE "tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
