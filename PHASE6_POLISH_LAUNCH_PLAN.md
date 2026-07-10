> Companion to [[ROADMAP]] (weeks 23–26, source of truth for exit criteria), [[ARCHITECTURE]] §4.10-4.11 + §9-10 (module specs) and [[DATABASE]] (schema — see Doc-trust note). See [[Dev Log]] for how Phases 0–5 actually went, and [[PHASE5_INTELLIGENCE_PLAN]] for the sibling doc this one is modeled on.

# Phase 6 — Polish & Launch

## How to use this doc

Phase 6 (`ROADMAP.md` weeks 23-26) is four chunks below, one per roadmap week — same granularity as every prior phase. **Do the chunks in roadmap order (A→B→C→D), but unlike Phase 5 this is soft sequencing, not a hard dependency chain** — see Sequencing notes. **Verify per chunk, not consolidated at the end** — closer to the Phase 2-4 pattern than Phase 5's, and explicitly chosen here because B (performance/security) and D (deploy/backup) are operationally risky in a way that benefits from immediate feedback, not a four-chunk-deep discovery. Close out each chunk with a dated `Dev Log.md` entry.

**Four scope decisions were made up front (2026-07-10, via user confirmation) rather than left as in-flight ambiguity — see each chunk for where they land:** dashboard customization is per-role not per-user; scheduled-report email in dev logs-and-marks-sent rather than adding a Mailpit container; the already-shipped self-service `/register` flow satisfies "tenant onboarding flow," no new staff console is built; "subscription management UI" is a per-tenant status page, not a cross-tenant admin console.

## Doc-trust note

Genuinely mixed picture, worse than any prior phase:

- **Week 23 (Reports/BI):** `ARCHITECTURE.md` §4.10 names an 8-report table (Sales Summary, Inventory Status, Purchase Analysis, Financial Report, Employee Performance, Customer Analytics, Waste Report, AI Recommendations) but gives **zero schema** for report templates, scheduling, dashboard config, or widgets. `DATABASE.md` doesn't mention `reports`/`scheduled_reports`/`dashboards`/`widgets` at all — not even a stub, unlike Phase 4's `financial_periods`-style "named with zero columns" cases. Treat all of Week 23's schema as **net-new, designed from scratch here**, same posture Phase 3/4 used for `SupplierQuote`/`CustomerPrice`.
- **Week 24 (Performance/Security):** no schema at all — pure infra/config/index work. Confirmed via repo inspection: no `middleware.ts` exists anywhere (fully greenfield rate limiting), `next.config.ts` has no `headers()` (no CSP today), `src/server/realtime/server.ts` lines 37-38 has a self-flagged dev-only wildcard CORS comment.
- **Week 25 (Multi-Store/Tenant Polish):** `Tenant.subscriptionPlan`/`subscriptionStatus`/`subscriptionEndsAt` and `subscription_status_enum` are already live (`DATABASE.md` §4, `prisma/schema.prisma`) — no new billing schema needed, no payment gateway named anywhere in either source doc. `UserStore` is confirmed a bare `(userId, storeId)` junction with zero metadata; `UserRole.storeId` (nullable) is the only existing store-scoping mechanism, and it scopes *roles*, not general store visibility. `src/lib/auth.ts` line 76 confirmed live: `storeId: user.userStores[0]?.storeId ?? null` — session resolves exactly one store even for multi-store users. `src/app/api/stores/route.ts` confirmed to export only `GET`.
- **Week 26 (Launch Prep):** confirmed zero `scripts/` directory, zero `docs/` directory, zero root `README.md`, only `Dockerfile.dev` exists (no prod Dockerfile), `docker-compose.yml` is dev-only (bind mounts, `next dev --webpack`). No Sentry/nodemailer/pino in `package.json`. `.github/workflows/ci.yml` has lint/typecheck/test jobs only, no deploy/build-and-push job.

**A framing note, worth stating explicitly since it contradicts part of `ARCHITECTURE.md`:** §9.2's "Production" diagram shows Nginx/Caddy + horizontally-scaled Next.js + Postgres read replicas. That's aspirational and **not** this phase's target — `ARCHITECTURE.md` itself says the monolith+microservice split "simplifies deployment for the initial market (Algeria, where devops expertise is limited)," and the existing `docker-compose.yml`/`Dockerfile.dev` shape is single-host throughout Phases 0-5. **Resolution, mirroring every prior phase's divergence-table pattern: Week 26 targets a single-VM docker-compose deployment, not §9.2's scaled diagram** — a deliberate divergence, not an oversight.

---

## Chunk A — Reports & BI (Week 23)

**Goal:** every role can generate one of five pre-built report templates against real data, export any report to PDF/Excel/CSV, get reports emailed on a schedule, and see a role-customized KPI-widget dashboard — reusing Phase 3/4/5's existing report services rather than duplicating them.

### Schema

Fully net-new (doc-trust note above) — two new tables, no persisted "report definition" table:

- **Decision — no generic `Report` table.** The five templates (sales, inventory, purchase, financial, employee) map onto fixed code, not tenant-configurable rows: a `ReportType` enum (`sales/inventory/purchase/financial/employee`) routes to one service function each. Same "criteria fixed in code, not a config table" precedent as Phase 5 Chunk C's MCDA criteria list.
- **New — `ScheduledReport`**: `id, tenantId, reportType (ReportType), name, filters (Json — storeId?/relative date window/other per-report params), format (ReportExportFormat: pdf/xlsx/csv), frequency (ReportFrequency: daily/weekly/monthly), recipientEmails (String[]), isActive, lastRunAt, lastRunStatus (ReportRunStatus: success/failed, nullable), lastRunError (nullable text), createdBy (FK User), createdAt, updatedAt, deletedAt`. New enums `ReportType`, `ReportExportFormat`, `ReportFrequency`, `ReportRunStatus`.
- **New — `DashboardLayout`**: `id, tenantId, role (String, matches Role.name), widgets (Json — ordered array of widget keys ± per-widget config), updatedAt, updatedBy (FK User)`, `@@unique([tenantId, role])`. **Decided: per-role** (one shared layout per role per tenant), matching the roadmap's literal "per role" wording. A user with multiple roles renders the first role's layout (documented, acceptable — dashboard layout is cosmetic, not an access-control gap). If no `DashboardLayout` row exists for a role yet, fall back to a hardcoded default widget set — no migration/seed needed to bootstrap defaults.

### Data export utility (used by every report, old and new)

- **New `src/server/services/report-export.ts`**: `exportReportToBuffer(rows, columns, format: "csv"|"xlsx"|"pdf")` — for csv/xlsx, generalizes `src/server/services/product-export.ts`'s `XLSX.utils.json_to_sheet`/`XLSX.write` pattern (currently product-specific, this makes it generic over any row/column shape). For pdf, **new `src/server/services/report-pdf.tsx`** modeled directly on `src/server/services/invoice-pdf.tsx`'s `Document`/`Page`/`View`/`Text`/`StyleSheet` shape and its non-breaking-space `formatDa` workaround — a generic tabular report layout (title, filter summary line, column headers, rows, optional totals row) rather than invoice-specific markup.
- **Retrofit, not rebuild:** `src/server/services/financial-reports.ts`, `financial-reports-advanced.ts` (Phase 4 Chunk A/C), `procurement-reports.ts` (Phase 3), `employee-performance.ts` (Phase 4) each get a small additive `?format=pdf|xlsx|csv` handler added to their existing routes calling the new shared `exportReportToBuffer` — extends the one-off `?format=csv` precedent already on `/api/finance/tax-report` into a shared utility, same "extend existing shipped code" posture Phase 4/5 used for their `sales.ts` touches.
- **Two missing report domains, built net-new:** `src/server/services/sales-report.ts` (`getSalesSummaryReport` — daily/weekly/monthly buckets, top products, average basket; modeled on `financial-reports.ts`'s `getRevenueDashboard` granularity pattern) and `src/server/services/inventory-report.ts` (`getInventoryStatusReport` — stock value, low-stock, overstock, expiring items; reuses `procurement-reports.ts`'s reorder-suggestion query + Phase 5 Chunk B's expiring-batch logic, reused not reimplemented).

### Report scheduling / email

- **New `src/lib/email.ts`**: `sendEmail({to, subject, html, attachments})` via `nodemailer` (new dependency) against `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` env vars, all **empty in `.env.example`/dev by default**. Real SMTP integration point, not a stub — flipping to production email later needs zero code changes, just env vars, mirroring how `AI_ENGINE_URL`/`INTERNAL_TOKEN` are already real-integration-point env vars with dev-safe defaults.
- **Dev-mode fallback (decided):** when `SMTP_HOST` is unset, `sendEmail` logs the would-be send (recipients, subject, attachment names) via Chunk D's structured logger and returns success — a `ScheduledReport` run in dev marks `lastRunStatus: success` with a `lastRunError`-style note ("logged, not sent — SMTP not configured"). No Mailpit/MailHog container is added; this unblocks per-chunk verification without real credentials or extra infra. (If a real local SMTP catcher is ever wanted, note it as a commented-out `docker-compose.yml` service addition later — not scoped here.)
- **Scheduling mechanism:** new `reportQueue` in `src/server/queue/queues.ts` using BullMQ's `repeat: {pattern: cron}` — **the first repeatable/cron-based BullMQ usage in the app** (Phase 5's queues are all one-shot). New processor in `src/server/queue/worker.ts`. **Decision — fixed times, not user-configurable time-of-day:** daily/weekly/monthly frequencies map to fixed cron patterns (e.g. 06:00 tenant-local); roadmap says "generate and email," not "at a custom time" — scoped down deliberately.
- **RLS/transaction discipline:** the job handler follows Phase 5's own lesson exactly — export data in one short `withTenant` transaction, close it, call `sendEmail` (external I/O, must not hold a transaction open across it — this already caused `P2028` under lighter load in Phase 4 Chunk C), then a second short transaction to write `lastRunAt`/`lastRunStatus`.
- Generated report buffers are uploaded to MinIO via a generalized version of `src/lib/storage.ts`'s `uploadPdf` (extended to accept any buffer/contentType, not just PDF) before emailing — gives every scheduled run a durable, re-downloadable artifact, same storage backend already provisioned.

### KPI widgets library

- **Static in-code catalog**, `src/config/kpi-widgets.ts`, same shape as `src/config/nav.ts`: `{key, labelKey, icon, requiredPermission, fetch(tx, {storeId?}) => {value, tone?}}`. No new table — widgets render via the existing `StatTile` component. Roughly a dozen entries: the 4 already on `(dashboard)/page.tsx` today (low stock, open POs, pending counts, today's sales) plus new ones (AR overdue amount, cash on hand, top product today, employee headcount, AI recommendation count, forecast MAPE average, waste-risk count, expenses this month) — each permission-gated so a `CASHIER`'s available widget set is naturally smaller than `BUSINESS_OWNER`'s.
- New `GET/PATCH /api/dashboard-layout` route — `GET` returns the caller's role's layout (or the default), `PATCH` (gated by new `reports:customize` permission, BUSINESS_OWNER/STORE_MANAGER only) reorders/toggles widgets.
- `(dashboard)/page.tsx` gets a "Customize" affordance for permitted roles; all roles render from the widget catalog + the resolved `DashboardLayout`.

### Frontend

- `groups.reports` nav gets two new entries: `/sales-report`, `/inventory-report` (5 entries total in that group now — matches the existing `procurement-reports`/`financial-reports`/`employee-performance` pattern exactly).
- Every report page (new and existing) gets Export buttons (PDF/Excel/CSV, gated by already-seeded `reports:export`) and a "Schedule" quick action.
- New `src/app/[locale]/(dashboard)/report-schedules/page.tsx` — a single management list across all report types (settings-shaped CRUD, same precedent as Phase 4 Chunk C's `financial-periods` page), rather than five duplicated per-report schedule UIs.
- i18n: `reports.*` (new namespace for sales/inventory report pages + shared export/schedule UI strings), `reportSchedules.*`, `dashboardLayout.*`.

### Key decisions

- Generic export utility over per-route one-offs (extends the existing tax-report CSV precedent rather than repeating it five more times).
- `DashboardLayout` keyed by role, not user.
- Real SMTP integration point + safe dev no-op fallback, no Mailpit container.
- New permission `reports:customize` (BUSINESS_OWNER/STORE_MANAGER-only) — narrow, sensitivity-scoped, same precedent as `finance:period`/`employees:payroll`. Scheduling reuses the already-seeded `reports:export` rather than minting a new string (scheduling is "export, but recurring").

### Exit criteria

Matches `ROADMAP.md` Week 23 verbatim: pre-built report templates (sales, inventory, purchase, financial, employee); report scheduling (generate and email); dashboard customization (per role); data export (PDF, Excel, CSV) on all reports; KPI widgets library.

---

## Chunk B — Performance & Security (Week 24)

**Goal:** hot queries are measured and indexed where the numbers justify it, API latency targets are verified under simulated load, and the app closes its known rate-limiting/CORS/CSP gaps.

### Schema

None — this chunk is entirely index migrations + infra/config.

### DB query optimization

- Run `EXPLAIN ANALYZE` against the hottest queries: Chunk A's new report queries (plausibly the heaviest reads in the app), POS sale creation (`completeSale`), the dashboard's `Promise.all` bundle. **Verify before indexing, don't index speculatively** (per roadmap's own "EXPLAIN ANALYZE, indexes" wording, in that order): concrete candidates flagged by research — `Sale` currently has only single-column indexes (`tenantId`, `storeId`, `cashierId`, `createdAt`), no composite `(storeId, createdAt)` for date-range-scoped-to-store report queries; `SaleItem` has no composite for "top products" joins through `Sale`. Add composite indexes only where a live `EXPLAIN ANALYZE` against seeded/demo-scale data shows a sequential scan the composite would resolve — document the before/after plan in the Dev Log entry, same evidentiary standard as a code review finding.
- `StockMovement`'s existing `@@index([productId, storeId, createdAt])` is confirmed already well-shaped — no change needed there, cited as the pattern any new composite index should follow.

### API response time optimization

- Primary lever is the indexing above, plus an audit pass over `findMany` calls (106 occurrences confirmed across services) for two common issues: over-fetching relations via `include` where only a few fields are needed, and unbounded results missing `take`/pagination on list routes. **No response-caching layer this phase**: Redis is provisioned, but introducing tenant-scoped read caching risks staleness bugs disproportionate to what's needed to hit 300ms once queries are properly indexed — flagged as a legitimate future optimization, not required now.

### Load testing (100 concurrent users)

- **`autocannon`** (new devDependency), not `k6`. Rationale: `k6` needs a separate Go binary install with no current precedent in this repo (Playwright is installed/removed ad hoc per session — the repo actively avoids maintaining non-npm tooling as a standing dependency); `autocannon` is pure npm, runs from the same Node/Docker environment already used for everything else, and its `-c 100` flag directly matches "simulate 100 concurrent users." Run against POS sale creation, dashboard, and report-generation routes with the stack up via `docker compose up`; record p50/p95 in the Dev Log entry. **Not wired into CI as a standing gate** — a one-time (per-chunk, re-run if regressions suspected later) manual exercise, matching the phase's 4-week/Medium-risk budget; a perf-regression CI job is out of scope.

### Security audit (pen-testing basics)

- **A structured checklist pass, not new tooling.** Concretely: (1) grep-audit every route for `requirePermission` presence; (2) grep for `prismaSuperuser` usage outside its three legitimate call sites (`auth.ts` login lookup, `register.ts`'s tenant-creation transaction, `prisma/seed.ts`) — any other hit is an RLS-bypass bug; (3) cross-check every phase doc's "Migration/RLS notes" table against live migrations to confirm no table shipped without its `ENABLE ROW LEVEL SECURITY` + tenant policy; (4) confirm Zod validation on every mutating route; (5) confirm bcrypt hashing + lockout (`MAX_FAILED_LOGIN_ATTEMPTS`/`LOCKOUT_DURATION_MINUTES`, already implemented in `auth.ts`) is still intact; (6) confirm no secrets committed to git history. Output is a checklist recorded in the Dev Log, not new application code — matches "basics" per roadmap wording.

### Rate limiting on all API endpoints

- **New `middleware.ts` at repo root** (confirmed nonexistent today — fully greenfield). **Hand-rolled Redis INCR+EXPIRE, not a library** (e.g. `@upstash/ratelimit`): the existing `redisConnection` (from `src/server/queue/queues.ts`) is already a plain self-hosted `ioredis` client; a sliding-window/token-bucket counter is a few lines and matches this repo's established preference for hand-rolled math over adding a dependency (Phase 5's AHP/EOQ math is TS, not a pulled-in stats library). Key by `{ip}:{route-prefix}` for unauthenticated routes (stricter limits on `/api/auth/*`, directly matching `ARCHITECTURE.md`'s own `429 Rate Limited`/"Brute force attempt" error-category entry), `{tenantId}:{userId}` for authenticated ones once session is resolvable in middleware.

### CORS hardening

- Fix the explicitly self-flagged gap: `src/server/realtime/server.ts` line 38's `cors: { origin: "*" }` → `origin: process.env.APP_URL`, exactly matching the comment's own stated intent ("a real deploy would scope this to APP_URL"). **No broader CORS layer needed**: nothing else in the app currently needs cross-origin browser access beyond the app's own origin; `python-ai`/`worker`/`realtime` service-to-service calls aren't browser CORS concerns.

### CSP headers

- New `headers()` function in `next.config.ts` (currently has none): `Content-Security-Policy` (`default-src 'self'`, explicit `connect-src` allowance for `NEXT_PUBLIC_REALTIME_URL`'s WebSocket origin, verify at build time whether Tailwind/Radix need an inline-style allowance or a nonce), plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. Next's built-in `headers()` API is sufficient — no `next-secure-headers` package needed.

### Exit criteria

Matches `ROADMAP.md` Week 24 verbatim: DB query optimization (EXPLAIN ANALYZE, indexes); API response time optimization (<300ms reads, <1s writes); load testing (100 concurrent users); security audit (pen-testing basics); rate limiting on all API endpoints; CORS hardening; CSP headers.

---

## Chunk C — Multi-Store & Multi-Tenant Polish (Week 25)

**Goal:** a multi-store user's session correctly reflects every store they're assigned to, store-scoped routes enforce that assignment, owners get a cross-store aggregate view, stock transfers get final polish, and tenant onboarding/subscription have admin-facing surfaces.

### The real blocker, addressed first

- `src/lib/auth.ts` line 76 (`storeId: user.userStores[0]?.storeId ?? null`) confirmed live — resolves exactly one store even when a user has multiple `UserStore` rows. **This is the single most consequential change in Phase 6:** change the session shape from `storeId: string | null` to `storeIds: string[]`, touching `src/types/next-auth.d.ts`, `src/lib/auth.config.ts`'s JWT/session callbacks, `src/lib/auth.ts`, and the 3 confirmed consuming call sites (`src/app/api/pos/sessions/route.ts`, `src/app/[locale]/(dashboard)/purchase-orders/new/page.tsx`, `src/components/pos/pos-view.tsx`). Each of those 3 currently assumes single-store; derive a `primaryStoreId` (first `storeIds` entry, preferring the `isMain` store if present) for those single-store-assuming defaults, while `storeIds` becomes the source of truth for access checks.
- **Known unresolved gap, re-verify don't assume:** research flags `admin@tenant-a.demo`'s `userStores[0]` reportedly resolving empty in the session despite a seeded `UserStore` row, last mentioned 2026-07-09, never confirmed fixed through Phase 5. **First concrete step of this chunk:** log in as that demo user post-session-shape-change and inspect `storeIds` directly — root-cause if still broken, since a broken multi-store demo user blocks this whole chunk's verification.

### Schema

No new tables. `storeIds` is derived at login time from the already-existing `UserStore` table — a code-only change, not a migration.

- **`POST /api/stores`** — the flagged gap (`src/app/api/stores/route.ts` currently GET-only, confirmed). Build it now — reuse whatever `createStore` service logic `register.ts`'s transaction already uses (don't duplicate) — gated by new permission `stores:create` (BUSINESS_OWNER-only). Also add `PATCH/DELETE /api/stores/[id]` if not already present (verify first), and a new `src/server/services/user-stores.ts` (`assignUserToStore`, `revokeUserFromStore`, `listUserStores`) + `POST/DELETE /api/user-stores` — `UserStore` creation is currently `seed.ts`-only, this closes that gap the same way Phase 3's own Dev Log flagged it should ("worth a real 'add store' flow whenever multi-store becomes a first-class concern" — this is that moment).

### Store-level permissions

- **New `requireStoreAccess(session, storeId)` in `src/lib/permissions.ts`**, mirroring `requirePermission`'s shape and called alongside it at the route layer wherever `storeId` is already a route param/body field. **Route-layer check, not injected into `withTenant` globally**: `withTenant` is called from 24+ store-scoped service files; changing its signature to also carry store-access logic is a far bigger blast radius than adding one explicit call where `storeId` is already known. **BUSINESS_OWNER bypasses the check** (owners see every store in their tenant by definition, same posture as `ALL_PERMISSIONS`); everyone else is checked against `session.user.storeIds`. New error `StoreAccessDeniedError` (403), registered in `service-errors.ts`.

### Multi-store dashboard (aggregate view across stores)

- New `src/app/[locale]/(dashboard)/multi-store/page.tsx` — additive to, not a replacement of, `(dashboard)/page.tsx` (which stays the tenant-wide landing page). Store-by-store breakdown table + per-store `StatTile`s reusing Chunk A's KPI-widget fetchers (parameterized by `storeId`), plus a cross-store comparison chart per the **dataviz skill** (bar-per-store, matching Phase 5's `forecasts-tab`/`supplier-ranking-view` chart conventions). Nav item conditionally shown to `storeIds.length > 1` users or BUSINESS_OWNER.

### Cross-store stock transfers (final polish)

- Research confirms `stock-transfers.ts`'s `createTransfer→approveTransfer→sendTransfer→receiveTransfer/cancelTransfer` are all single-shot (no partial multi-shipment support, unlike PO's partial-delivery machinery). **Scope modestly, per roadmap's own "final polish" wording** (not a rebuild toward PO-style partial shipments): (1) wire `requireStoreAccess` into the transfer routes so users can only send/receive against stores they're assigned to; (2) add store filtering to the existing `/stock-transfers` list UI; (3) **explicitly flag partial-shipment support as out of scope**, a documented follow-up — avoids the rest of the week's budget being consumed by a materially bigger feature.

### Tenant onboarding flow (self-service or admin-assisted)

- **Decided: self-service already ships and is sufficient.** `src/app/api/auth/register/route.ts` + `/register` already creates Tenant + main Store + system roles + owner User + UserRole/UserStore in one transaction — this satisfies the roadmap's "self-service **or** admin-assisted" (either/or) wording. No new cross-tenant `PLATFORM_ADMIN` console is built (`PLATFORM_ADMIN` is deliberately excluded from Phase 0 seeding, per `src/lib/constants.ts`'s own comment — building a staff console is a materially bigger, currently entirely unbuilt surface, out of scope here). This chunk's job is verification + light polish: (1) confirm the flow produces a genuinely multi-store-ready tenant (test adding a 2nd store via the new `POST /api/stores` right after registering); (2) add a lightweight "setup checklist" banner on `(dashboard)/page.tsx` for brand-new tenants, driven by simple existence checks (`products.count() === 0`, etc.) — no new persisted onboarding-progress table, keeps this additive/low-risk.

### Subscription management UI (admin panel)

- **Decided: a per-tenant status page, not a cross-tenant staff console.** Admin UI over the already-live `Tenant.subscriptionPlan`/`subscriptionStatus`/`subscriptionEndsAt` fields (`subscription_status_enum` confirmed live) — no new Subscription/Plan/billing table, no payment gateway integration (none named anywhere in either source doc, no Stripe/CIB/Satim reference exists). New `src/app/[locale]/(dashboard)/subscription/page.tsx`, BUSINESS_OWNER-only, read-mostly status panel with a manual "request a plan change" action (no self-serve billing since no gateway exists). A cross-tenant `PLATFORM_ADMIN` console (using `prismaSuperuser` to edit any tenant's fields directly) is out of scope for this phase — flagged as a Phase 6-adjacent follow-up if ever needed.

### Permissions

New: `stores:create`, `stores:manage` (assign/revoke `UserStore`) — BUSINESS_OWNER-only. `subscription:read`/`subscription:manage` — BUSINESS_OWNER-only, following the same narrow-grant precedent as `finance:period`.

### Exit criteria

Matches `ROADMAP.md` Week 25 verbatim: multi-store dashboard (aggregate view across stores); store-level permissions (user can access only assigned stores); cross-store stock transfers (final polish); tenant onboarding flow (self-service or admin-assisted); subscription management UI (admin panel).

---

## Chunk D — Launch Preparation (Week 26)

**Goal:** the stack deploys from a documented single-VM script, can be backed up and restored, has basic monitoring and error tracking wired in (dev-safe defaults), and ships with real user/admin docs plus a proper demo dataset.

### Schema

None.

### Production deployment script

- Per the framing resolution above (single-VM docker-compose, not §9.2's scaled diagram): new **`docker-compose.prod.yml`** — same services as dev, but a new **`Dockerfile`** (non-dev multi-stage build using `output: "standalone"`, already configured in `next.config.ts`) replacing `Dockerfile.dev` for prod use, no bind mounts, `node server.js` instead of `next dev --webpack`, real env-file usage. New **`scripts/deploy.sh`**: pull latest → `docker compose -f docker-compose.prod.yml build` → `prisma migrate deploy` (not `migrate dev`) → `docker compose up -d` → smoke-check.
- **A new readiness route, not a repurposed one:** `src/app/api/health/route.ts` is deliberately DB-free (its own comment: used by the POS offline-sync heartbeat, must stay reachable/fast even if the DB is briefly unhappy). A real deploy smoke-check needs a true readiness probe — add a separate `GET /api/health/ready` that does touch the DB, rather than changing the existing route's documented contract.
- **No Kubernetes/Terraform/cloud CI-deploy pipeline** — matches "monolith... low-devops" framing exactly.

### Backup/restore procedures

- **`scripts/backup.sh`** (`pg_dump` the Postgres container + `mc mirror` for the MinIO bucket, timestamped, retained N days) and **`scripts/restore.sh`** (`psql < dump` / `mc mirror` reverse). **Plain scripts + a documented host crontab line, not a new BullMQ job**: backups are infra-ops, not app-domain work; keeps `worker.ts` scoped to application jobs (forecast/mcda/simulation/report), matching its existing scope exactly.

### Monitoring setup (basic)

- **No new observability stack** (no fresh Prometheus/Grafana for a single-VM target in a 1-week budget). Reuse the docker healthchecks every service already has (`docker compose ps`) as the baseline. Add a lightweight **new `src/lib/logger.ts`** — hand-rolled ~30-line structured logger (JSON shape: timestamp, level, tenantId-if-available, route, message), no new dependency, matching this repo's established low-dependency-footprint style. Used at unhandled-route-error, worker-job-failure, and realtime-connection-error points. "Monitoring" here is `docker compose logs -f` + health-endpoint polling, documented in `docs/admin-guide.md`, not a new dashboard product.

### Error tracking (Sentry or equivalent)

- Configure `@sentry/nextjs` (new dependency) pointed at `SENTRY_DSN`, **empty by default in `.env.example`/dev** — this is standard Sentry SDK behavior (no-op when DSN unset), not a custom guard to write. Ships a real integration point activated by one env var in prod, whether pointed at Sentry SaaS, self-hosted Sentry, or GlitchTip (an open-source Sentry-API-compatible alternative, worth naming in `docs/admin-guide.md` given the low-budget Algeria context). Pairs with, doesn't replace, the new logger — logger = "what happened locally," Sentry = "alert someone," different failure modes.

### User & admin documentation

- **New `docs/` folder** (confirmed nonexistent). `docs/user-guide.md` — getting-started walkthrough: onboard tenant → first store → first products → first sale → first report, following the exact flow Chunk C's onboarding checklist banner points at. `docs/admin-guide.md` — deployment (points at `scripts/deploy.sh`), backup/restore, environment variables (expands `ARCHITECTURE.md` §9.3's list with Phase 6 additions: `SMTP_*`, `SENTRY_DSN`), troubleshooting (error-category table, RLS gotchas, reading `docker compose ps` health states).
- **Decided: fr-only for v1.** Matches the app's `fr-DZ` default locale. Whether `docs/` prose needs en/ar translation (distinct from the app's next-intl JSON i18n) is deferred as a fast-follow, not blocking this chunk.
- **New root `README.md`** — confirmed genuinely missing; not literally named in the roadmap but a launch-readiness gap regardless. Points to `docs/`, `ARCHITECTURE.md`, `ROADMAP.md`, quick `docker compose up` instructions.

### Demo data package

- **Extend `prisma/seed.ts`'s existing `DemoTenantSpec` pattern**, not a parallel seed system: richer product/category set with realistic Algerian retail data, several weeks of backdated `Sale` history (so Chunk A's reports and Phase 5's forecasts have something to show immediately on a fresh demo), at least one populated `ScheduledReport` and `DashboardLayout` per role, and multi-store `UserStore` assignments that actually work end-to-end (closing Chunk C's known seed bug). Packaged as a `pnpm prisma:seed:demo` variant/flag on the existing seed script, not a forked second copy to maintain.

### Exit criteria

Matches `ROADMAP.md` Week 26 verbatim: production deployment script; backup and restore procedures; monitoring setup (basic); error tracking; user documentation; admin documentation; demo data package.

**Phase 6 overall exit criteria (`ROADMAP.md`, verified at the end of this chunk):** "A new tenant can be onboarded, set up their store, add products, process sales, and view reports. The AI engine produces actionable recommendations." — verified by literally running `scripts/deploy.sh` against a clean environment and walking `docs/user-guide.md` step by step, confirming a Phase 5 AI recommendation is visible (Phase 6 must not regress it).

---

## Sequencing notes

Roadmap week order (A→B→C→D), but **soft, not hard** — closer to Phase 3/4's session-sizing convenience than Phase 5's genuine dependency chain:

- **A before B is mildly beneficial, not required:** B's rate-limiting middleware and load-testing exercise are more realistic if they cover Chunk A's new report/schedule routes rather than being retrofitted after those routes land; report generation is plausibly the heaviest read query in the app, and B's load test wants that in the mix. B could technically go first against the pre-Chunk-A route surface without breaking anything.
- **A before C is mildly beneficial, not required:** C's multi-store dashboard reuses Chunk A's KPI-widget fetcher catalog (parameterized by `storeId`) — building it once in A avoids building it twice. C could stub simple `StatTile`s directly if forced to go first.
- **C's `storeIds` session-shape change should land before D's demo-data/deployment verification**, so Chunk D's final walkthrough exercises the corrected multi-store session shape, not the old single-store one — this is the one place with a real ordering reason (D's exit-criteria walkthrough needs C's fix to be meaningful for a multi-store tenant).
- **B and C have no dependency on each other** — B's rate-limiter doesn't need C's `storeIds`, C's store-access-control doesn't need B's rate-limiter. Could be swapped or parallelized by two developers without issue.
- **D is last unconditionally** — deployment scripts/docs/demo-data are a wrap-up chunk that should reflect A's `SMTP_*` env vars and D's own `SENTRY_DSN`, both of which need to exist before `docs/admin-guide.md`'s env-var table is complete.

**Net: A → B → C → D**, matching the roadmap's own week order, with **per-chunk verification** (not consolidated like Phase 5) explicitly because B and D are the kind of operational work where a regression is expensive to discover three chunks later.

## Migration/RLS notes

Standard boilerplate (tenant-column default + `GRANT` + `ENABLE ROW LEVEL SECURITY` + tenant-isolation `CREATE POLICY`) applies to:

- **Chunk A:** `scheduled_reports`, `dashboard_layouts` — the only two new tables in the whole phase.
- **Chunk B:** none — index migrations only (`CREATE INDEX`), no RLS-relevant schema change.
- **Chunk C:** none — `requireStoreAccess` is a route-layer check over the already-RLS'd `user_stores`/`user_roles` tables (RLS'd since Phase 0), no new table. The `storeId → storeIds` session-shape change is **code-only**, derived from existing `UserStore` rows at login, not a migration.
- **Chunk D:** none.

Phase 6 is the lightest phase yet, schema-wise — two new tables total, versus 3-9 in every prior phase.

## Verification plan (per chunk, not consolidated)

- **A:** generate all 5 report templates against seeded data; confirm PDF/Excel/CSV exports open correctly in real viewers; create a `ScheduledReport` with a short test frequency, confirm the worker fires it and (SMTP unset in dev) the logger shows a correct "would have sent" entry with the right recipients/attachment; customize a role's `DashboardLayout` and confirm it renders correctly for a user in that role.
- **B:** capture `EXPLAIN ANALYZE` before/after any index change on the flagged hot queries; run `autocannon -c 100` against POS-sale-creation/dashboard/report routes, record p50/p95 against the <300ms read / <1s write targets; hit a rate-limited route past its threshold and confirm `429`; confirm the realtime server now rejects a cross-origin connection attempt; inspect response headers for the new CSP.
- **C:** log in as the re-verified multi-store demo user, confirm `storeIds` has >1 entry; attempt a store-scoped route for a store NOT in `storeIds`, confirm `403`; create a 2nd store via the new `POST /api/stores`; view the multi-store aggregate dashboard; complete a cross-store stock transfer as a store-scoped user; register a brand-new tenant end-to-end via the existing self-service flow and confirm the onboarding checklist banner appears/clears; view the subscription panel.
- **D:** run `scripts/deploy.sh` against a clean/simulated environment, confirm the app comes up via `docker-compose.prod.yml`; run `scripts/backup.sh` then `scripts/restore.sh` against a scratch DB and confirm data round-trips; trigger a deliberate error and confirm it surfaces via the logger (and Sentry, if a test DSN is set); walk `docs/user-guide.md` literally as a brand-new user; run `pnpm prisma:seed:demo` and eyeball the resulting demo tenant.
- **Final pass:** walk `ROADMAP.md`'s Phase 6 exit-criteria sentence literally end-to-end using Chunk D's deploy script + demo data — onboard a tenant, set up a store, add products, process a sale, view a report, confirm an AI recommendation is visible.

## Critical files

- `prisma/schema.prisma` — Chunk A's `ScheduledReport`/`DashboardLayout` models + enums (the only schema change in the whole phase)
- `src/lib/auth.ts` + `src/lib/auth.config.ts` + `src/types/next-auth.d.ts` — Chunk C's `storeId → storeIds` session-shape change, the highest-blast-radius edit in this phase
- `middleware.ts` (new) — Chunk B's rate limiting, sits in front of every route
- `next.config.ts` — Chunk B's CSP/security headers
- `docker-compose.yml` + new `docker-compose.prod.yml`/`Dockerfile` — Chunk D's deployment target
- `src/server/queue/queues.ts` / `worker.ts` — Chunk A's new repeatable `reportQueue`, the app's first cron-based BullMQ job
- `prisma/seed.ts` — Chunk D's demo-data extension, plus every chunk's `PERMISSION_CATALOG` additions
- `PHASE5_INTELLIGENCE_PLAN.md` — structural template this doc mirrors
