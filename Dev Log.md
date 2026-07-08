# Dev Log

Running log of work sessions on RetailOS. Newest entries at the top. See [[ROADMAP]] for the phase plan, [[ARCHITECTURE]] and [[DATABASE]] for the design this work follows.

---

## 2026-07-08 — Phase 0 Foundation scaffold

**Done:**
- Scaffolded the full [[ROADMAP]] Phase 0: Next.js 16 (TS strict) + Tailwind 4/shadcn, Prisma schema (Tenant/Store/User/Role/Permission), NextAuth v5 credentials auth, next-intl (fr/ar/en, URL-prefixed routing), docker-compose (Postgres/Redis/MinIO) — everything runs in Docker since Node isn't installed locally.
- Two-Postgres-role RLS setup (`postgres` superuser for migrations/seed, `app_user` for the running app) so tenant isolation is enforced at the database level, not just in application code.
- Seed script creates two demo tenants (`admin@tenant-a.demo`, `admin@tenant-b.demo`, password `Demo1234!`) for testing isolation.
- Verified end-to-end: `docker compose up` → login as either tenant → dashboard shows only that tenant's own data. Automated as a vitest RLS regression test (`src/lib/rls.test.ts`).
- Committed and pushed to `github.com/MoumenHouma/retailOS` (main).
- Re-rooted this Obsidian vault here so the planning docs are all visible together.

**Bugs found and fixed during verification (worth remembering if they resurface):**
- `next-intl@3.26.5` doesn't export `hasLocale` (that's a newer API) — replaced with a plain `.includes()` check in `src/i18n/request.ts` and `src/app/[locale]/layout.tsx`.
- Wrapping NextAuth's `auth()` around next-intl's middleware — the pattern both projects officially document — crashed the Edge runtime outright with this exact next-auth v5 beta / next-intl / Next 16 combination ("socket hang up", no catchable stack). Worked around it by splitting responsibilities: `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) only handles locale routing; `(dashboard)/layout.tsx` does the auth check + redirect server-side instead.
- The original RLS design used an `AsyncLocalStorage` context read by a Prisma `$extends` query middleware, so any code could just call the ambient `prisma` client without threading anything through. It silently returned empty results for every query — Prisma's lazily-evaluated `PrismaPromise` doesn't reliably propagate `AsyncLocalStorage` context into extension middleware. Replaced with an explicit `withTenant(tenantId, (tx) => ...)` in `src/lib/prisma.ts` that runs the transaction directly and hands callers a scoped `tx` client — no ambient state, guaranteed correct.
- RLS policies cast `current_setting('app.current_tenant_id', true)` straight to `::uuid`; the database-level default of `''` (empty string) made that cast throw a hard Postgres error instead of failing closed. Fixed with `NULLIF(..., '')` before the cast (migration `20260708195513_fix_rls_null_cast`).
- ESLint 9 + `eslint-config-next@16` no longer works through the legacy `FlatCompat` shim (circular JSON error) — `eslint-config-next` now ships a native flat-config array; import it directly instead.

**Open items for later phases:**
- `PLATFORM_ADMIN` role deferred — `roles.tenant_id` is `NOT NULL`, needs a schema decision for a cross-tenant role.
- Middleware-level auth gating (not just layout-level) still blocked on the next-auth/next-intl/Next 16 incompatibility above — revisit once versions move.
- Python AI/optimization engine not started — that's Phase 5.
