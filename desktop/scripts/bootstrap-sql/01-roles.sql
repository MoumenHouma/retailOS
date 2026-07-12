-- Desktop-edition port of docker/postgres/init/01-roles.sql.
--
-- Docker's version hardcodes the app_user password (fine for a dev-only
-- container); the desktop installer generates a random password per
-- install and persists it in config.json, so this script takes it as a
-- psql variable instead (`psql -v app_user_password='...' -f 01-roles.sql`).
-- Idempotent — run on every launch (mirrors `prisma migrate deploy`,
-- also safe to re-run), not just first run, since that's the only hook
-- point available without a docker-entrypoint-initdb.d equivalent.
-- Not a PL/pgSQL DO $$...$$ block: psql does not perform :'var'
-- interpolation inside dollar-quoted strings (confirmed live — it sends
-- the literal text ":'app_user_password'" to the server, a syntax
-- error), so the conditional has to be psql's own \if scripting instead.
SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') AS role_exists \gset

\if :role_exists
ALTER ROLE app_user PASSWORD :'app_user_password';
\else
CREATE ROLE app_user LOGIN PASSWORD :'app_user_password';
\endif

GRANT CONNECT ON DATABASE retailos TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Ensures tables created later by the `postgres` superuser (via Prisma
-- migrate) are automatically granted to app_user without a manual GRANT
-- after every migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
