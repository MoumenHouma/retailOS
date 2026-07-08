-- Creates the RLS-restricted runtime role used by the running app
-- (see .env DATABASE_APP_URL and src/lib/prisma.ts). Only runs once, on a
-- fresh `pgdata` volume — if this file changes after the volume already
-- exists, run `docker compose down -v` to force re-init.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE retailos TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Ensures tables created later by the `postgres` superuser (via Prisma
-- migrate) are automatically granted to app_user without a manual GRANT
-- after every migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
