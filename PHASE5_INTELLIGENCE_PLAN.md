> Companion to [[ROADMAP]] (weeks 18–22, source of truth for exit criteria), [[ARCHITECTURE]] §4.6 + §4.11 (module specs) and [[DATABASE]] §12 + §14 (schema). See [[Dev Log]] for how Phases 0–4 actually went, and [[PHASE4_FINANCE_PLAN]] for the sibling doc this one is modeled on.

# Phase 5 — Intelligence Layer

## How to use this doc

Phase 5 (`ROADMAP.md` weeks 18-22) is four chunks, one dev session each. **Unlike Phase 3/4, do the chunks in strict order** — this phase has a genuine dependency chain, not just session-sizing convenience (see Sequencing notes). Close out each chunk with a dated `Dev Log.md` entry.

**Execution note (this phase only):** per the auto-mode execution plan this doc was written under, all four chunks are built back-to-back first, then verified together in one consolidated end-to-end pass (not per-chunk like Phases 2-4), then pushed and logged together. See the Dev Log entries for this phase for how that actually went.

## Doc-trust note

`DATABASE.md §12` is fully column-specified for all three new tables (`supplier_evaluations`, `demand_forecasts`, `ai_recommendations`) — no schema gap to resolve, unlike Phase 3/4's ARCHITECTURE.md-only stubs. What's genuinely open is **infrastructure**: `ARCHITECTURE.md §4.11` names Python FastAPI + BullMQ + Socket.io but gives zero implementation detail (no directory layout, no job/event contract, no auth story). Confirmed via repo inspection: no `ai-engine/` directory, no `bullmq`/`ioredis`/`socket.io` in `package.json`, `docker-compose.yml`'s `python-ai` entry is a commented placeholder, Redis (`redis:7-alpine`) is already provisioned and healthy but unused by app code. `ai:view_recommendations`/`ai:run_forecast` permission strings are already seeded in `prisma/seed.ts`'s `PERMISSION_CATALOG.ai`, reachable today only via `BUSINESS_OWNER`/`STORE_MANAGER`'s `ALL_PERMISSIONS`.

## New infra (lands as part of Chunk A's session, before its feature work)

**Python microservice** — new `ai-engine/` directory at repo root (FastAPI, `requirements.txt` + plain pip — no Poetry/uv, this is one small dependency tree), own Dockerfile (`python:3.12-slim`, `build-essential` for `cmdstanpy`'s Stan compile), own `docker-compose.yml` service (`python-ai`, replacing the commented placeholder, healthcheck on `GET /health`). **Python never connects to Postgres directly** — RLS tenant isolation lives entirely in `withTenant`'s `SET LOCAL app.current_tenant_id` (`src/lib/prisma.ts`); giving Python its own `DATABASE_URL` would mean either bypassing RLS or duplicating tenant-scoping logic in a second language. Next.js exports already-tenant-scoped data and sends it over HTTP; Python is stateless compute only, never given `DATABASE_URL` at all (enforced by omission).

**Redis / BullMQ** — Redis already provisioned, add `bullmq`+`ioredis` as new deps. **Async job + client polling, not sync REST, not webhook**: Prophet fitting per `(product, store)` pair takes seconds each, a full catalog run is minutes — far past any HTTP timeout and would hold a `withTenant` transaction open for the duration (this already hit `P2028 Transaction already closed` under much lighter load in Phase 4 Chunk C). New `src/server/queue/{queues.ts,worker.ts}`, new `docker-compose.yml` service `worker` (own container, `pnpm exec tsx watch src/server/queue/worker.ts`). Worker job handlers use **two separate short `withTenant` transactions** (export data → close → call Python → open new transaction → write results), never one held open across the HTTP call — direct application of the Chunk C lesson. Client polls `GET /api/ai/forecasts/jobs/[jobBatchId]` via TanStack Query `refetchInterval` (same library/pattern used everywhere else already).

**Socket.io realtime** — Next.js App Router can't host a long-lived Socket.io server in-process. New standalone `src/server/realtime/server.ts` (bare `http`+`socket.io`, `@socket.io/redis-adapter` bound to the existing Redis so any process can trigger emissions via `redis.publish()` without holding a server reference), new `docker-compose.yml` service `realtime` (port 4001), new env `NEXT_PUBLIC_REALTIME_URL`. Auth: short-lived JWT (via `jose`, already a transitive `next-auth` v5 dependency) minted by the dashboard shell, verified on socket connect, joins room `tenant:{tenantId}` — reimplements RLS's isolation guarantee at the socket layer since RLS itself has no meaning there. Event name **`ai:recommendation`** (matches `ARCHITECTURE.md` exactly), emitted on every new `AiRecommendation` row and job completion. New `src/hooks/use-ai-notifications.ts` + `src/stores/ai-notifications.ts` (Zustand, matching existing state pattern) on the client.

Polling and push are both real and serve different needs: polling answers "I just clicked a button, tell me when it's done"; Socket.io push answers "something happened I didn't just ask about."

## Chunk A — AI Engine Setup & Forecasting (Week 18-19)

**Goal:** a real Prophet forecast can be triggered from the app, runs async through Python/BullMQ/Redis, lands in `demand_forecasts`, accounts for Algeria-specific seasonality, tracks MAPE accuracy, visible end-to-end in the UI.

- **Schema:** `DemandForecast` per `DATABASE.md §12.2` verbatim (`productId`, `storeId`, `forecastDate`, `predictedQuantity`, `predictedLower`/`predictedUpper`, `modelUsed` as free VarChar not enum — future ARIMA/XGBoost needs no migration, `modelVersion`, `accuracyMape`), `@@unique([tenantId, productId, storeId, forecastDate])`.
- **Data pipeline** (`src/server/services/forecasting.ts`): `exportSalesHistory` (groups `SaleItem`/`Sale` by product/store/day, sent inline in the job HTTP body — a product-store's history is a few thousand rows max, no MinIO staging needed at this scale); `triggerForecastRun` (enqueues one `forecastQueue` job per product×store pair in scope, returns `{jobBatchId, jobCount}`); `reconcileForecastAccuracy` (pure TS/Postgres MAPE math against actual `SaleItem` quantities, on-demand admin action — no scheduler infra exists yet, same precedent as Phase 4 Chunk D's on-demand commission calc).
- **Integration contract:** `POST /api/ai/forecasts/run` (202, enqueues) → worker's `forecastQueue` processor (export → `fetch POST {AI_ENGINE_URL}/forecast` → upsert `DemandForecast` rows, idempotent via the unique constraint → `publishTenantEvent`) → `GET /api/ai/forecasts/jobs/[jobBatchId]` (polled). Python's `/forecast` is pure compute: pandas dataframe → `Prophet(holidays=...)` → predict → return + `prophet.__version__`.
- **Seasonality:** static hand-maintained `ai-engine/app/calendars/dz_events.py` (Ramadan/Eid al-Fitr/Eid al-Adha/back-to-school, rolling current year ±2, refreshed manually — lunar-calendar dates shift yearly and are civil-authority-announced, not purely computable) shaped as Prophet's own `holidays` dataframe format with `lower_window`/`upper_window` ranges.
- **Frontend:** `src/app/[locale]/(dashboard)/ai-forecasts/page.tsx` — product/store picker, "Run Forecast," polls batch status, line chart with CI band (dataviz skill) on completion, toast via `use-ai-notifications` proving the Socket.io leg works too. New `groups.ai` nav group (houses all of Phase 5's UI, not scattered across existing groups). i18n `aiForecasts.*` in fr/en/ar.
- **Exit criteria:** matches `ROADMAP.md` Week 18-19 verbatim (microservice, data pipeline, Prophet forecasting, seasonality detection, MAPE tracking).

## Chunk B — Inventory Optimization (Week 20)

**Goal:** every trackable product gets computed `reorderPoint`/`safetyStock`, EOQ available, expiration risk predicted from real batch data, first real `AiRecommendation` rows created and pushed.

- **Prerequisite fix (research-flagged, resolved):** `ProductBatch.quantityRemaining` is not currently decremented by sales (confirmed in schema.prisma's own comment — FIFO/FEFO batch consumption deferred since Phase 3 Chunk B). Expiration prediction is meaningless without it. This chunk adds minimal **FEFO** (first-expired-first-out) batch consumption to `completeSale` in `src/server/services/sales.ts`, scoped to `isExpirable` products only (minimizes blast radius on the hot POS path) — same category of "extend shipped code" touch as Phase 4 Chunk B's two `sales.ts` edits.
- **Schema:** `AiRecommendation` per `DATABASE.md §12.3` verbatim + new `RecommendationType`/`Priority` enums per `§14`. This table **is** the notification store (`isRead`/`isActioned` already give it that shape) — no separate `Notification` model.
- **Math lives in TS, not Python** — EOQ/reorder-point/safety-stock are closed-form formulas over data already in Postgres (Chunk A's forecasts, `Supplier.leadTimeDays`, sales variance); routing through Python adds a network hop for arithmetic. `src/server/services/inventory-optimization.ts` (`calculateEOQ`, `calculateSafetyStock` via a static z-score table, `calculateReorderPoint`, `recomputeProductOptimization` — chained automatically at the end of a successful forecast job, not hooked into the hot POS path) + `src/server/services/waste-prediction.ts` (`predictExpirationRisk` — heuristic `daysToSellOut vs daysUntilExpiry`, explicitly **not ML**: no wastage/write-off training labels exist in the schema despite `ARCHITECTURE.md` pairing this with XGBoost; `generateWasteRecommendations` — banded markdown-% rule; `generateReorderRecommendations`).
- **Permission gap fix:** `ai:view_recommendations` added to `INVENTORY_CLERK` (currently has zero `ai:*` grant despite being the role that acts on these recommendations day-to-day) — same gap-fix precedent as Phase 3/4.
- **Frontend:** tabs added to `ai-forecasts` page (or a dedicated `waste-prevention` page) for reorder/EOQ view and expiring-batch list with suggested markdown — markdown application is a **user-confirmed suggestion**, never an autonomous price change.
- **Exit criteria:** matches `ROADMAP.md` Week 20 verbatim.

## Chunk C — Supplier Ranking / MCDA (Week 21)

**Goal:** AHP pairwise weighting → TOPSIS/PROMETHEE ranking → `Supplier.rating` populated → score history → purchase recommendations.

- **Schema:** `SupplierEvaluation` per `DATABASE.md §12.1` verbatim + `EvaluationMethod` enum per `§14`. One row per supplier per evaluation run (sharing `evaluationPeriod`/`criteriaWeights`). **Deviation from doc's example, documented:** `supplierScores` JSONB keys by `supplierId` (UUID), not supplier name — names aren't stable identifiers, every other JSONB payload in this schema keys by id.
- **Math lives in TS, not Python** — AHP/TOPSIS/PROMETHEE are small linear-algebra operations over a tens-of-suppliers × half-dozen-criteria matrix, no numpy/scipy needed; keeping it in TS means the whole flow (pairwise UI → weights → ranking → persist → update `Supplier.rating`) runs sync in one API route, no queue, no Python round-trip. `src/server/services/supplier-mcda.ts`: `calculateAhpWeights` (eigenvector-approximation, warns not blocks when consistency ratio ≥ 0.10 per `ARCHITECTURE.md`'s threshold), `buildSupplierDecisionMatrix` (sources 5 criteria from existing columns/queries — price from `SupplierProduct`/`PurchaseOrderItem`, quality approximated via `PurchaseReturn` rate — flagged as no dedicated quality input exists, delivery from `Supplier.leadTimeDays`, reliability reusing Phase 3 Chunk D's delivery-performance query, payment terms and product range from existing fields), `rankSuppliersTopsis`, `rankSuppliersPromethee` (linear + level preference functions only — covers the roadmap's stated use case, not all six classical types), `runSupplierEvaluation` (orchestrates, updates `Supplier.rating`), `getSupplierScoreHistory`, `generatePurchaseRecommendations` (joins Chunk B's reorder-flagged products with top-ranked suppliers — supersedes Chunk B's supplier-agnostic version once evaluations exist, gracefully degrades otherwise).
- **New permission `suppliers:evaluate`** — BUSINESS_OWNER/STORE_MANAGER only (supplier strategy stays ownership-level, same posture as `purchases:approve`).
- **Frontend:** `src/app/[locale]/(dashboard)/supplier-ranking/page.tsx` — AHP pairwise slider-grid (ui-ux-pro-max skill, no existing shadcn pattern fits this), weight breakdown + consistency-ratio indicator (dataviz), ranked results table, score-history trend chart (dataviz), purchase-recommendation tab feeding into Phase 3's existing PO-creation flow (reused, not reimplemented).
- **Exit criteria:** matches `ROADMAP.md` Week 21 verbatim.

## Chunk D — Scenario Simulation & Dashboard (Week 22)

**Goal:** what-if modeling with financial impact, unified AI recommendations feed, single optimization dashboard.

- **No new table for scenarios** — stateless request/response computation, same "pure aggregation, no new schema" precedent as Phase 3/4's reporting chunks.
- **Math in TS, sync (not a BullMQ job)** — applies deltas to already-known quantities (Chunk A forecasts, `Product.sellingPrice`/`costPrice`, `Expense` run-rates) and re-runs Phase 4's existing P&L formula, no model re-fitting needed. `src/server/services/scenario-simulation.ts`: `simulateScenario` (degrades to trailing-period actuals if no forecast covers the requested window, rather than forcing a synchronous fresh forecast). The `simulationQueue` scaffolded in New Infra exists only for an optional bulk "simulate whole catalog" variant, pushed via `ai:recommendation` when ready — the single-scenario interactive case stays sync for a responsive "drag a slider" UX.
- **Frontend:** `src/app/[locale]/(dashboard)/ai-dashboard/page.tsx` — the Phase 5 landing page, `StatTile`s from a new `GET /api/ai/dashboard-summary` aggregate route (reusing `StatTile`/`PageHeader` from the existing shared components), tabs into Forecasts/Inventory/Supplier Ranking. **Highest chart-density surface in the project — dataviz skill is mandatory here**, not optional (forecast CI bands, supplier trend lines, expiry heatmap, revenue/cost/profit comparisons, all needing a consistent palette/form against the existing OKLCH tokens in both light/dark). Scenario simulator component (sliders for price/demand/cost deltas, baseline-vs-projected comparison chart). Recommendations feed: a notification bell in the shared `(dashboard)/layout.tsx` shell (visible app-wide, not scoped to AI pages) with unread badge, dropdown panel, mark-read/actioned actions, live toast on incoming `ai:recommendation` events.
- **Exit criteria:** matches `ROADMAP.md` Week 22 verbatim.

## Sequencing notes

New infra → **A** (hard foundation, unconditional first) → **B** (before C: C's purchase-recommendation engine joins on B's reorder signals — building C first means testing against an empty signal set) → **C** → **D** (hard-depends on A+B+C all being done — aggregates all three, no parallelization possible). Strict order, no swaps — the first Phase where every chunk boundary is a real dependency, not just session-sizing convenience.

## ARCHITECTURE.md vs DATABASE.md divergences (resolved)

| Item | Resolution |
|---|---|
| `supplier_evaluation_criteria`/`supplier_scores` as separate tables (ARCHITECTURE.md) | No separate tables — DATABASE.md's JSONB-on-`supplier_evaluations` shape wins; criteria list is fixed in code, not tenant-configurable rows |
| `supplier_scores` JSONB keyed by supplier name (DATABASE.md example) | Keyed by `supplierId` (UUID) instead — documented deviation, matches every other JSONB payload in this schema |
| BullMQ + Socket.io pattern (ARCHITECTURE.md, zero detail) | Resolved in New Infra: async job + poll for completion, Socket.io/Redis-pub-sub for unsolicited push — both, different purposes |
| Python↔Postgres access | Next.js exports, Python never connects to Postgres directly — no `DATABASE_URL` given to the Python service at all |
| Expiration Prediction "XGBoost" (ARCHITECTURE.md) | Heuristic (days-to-sell-out vs days-to-expiry), not ML — no training labels exist in the schema yet; flagged as a real future upgrade |
| Scenario simulation persistence | No new table — stateless computation over existing data |
| In-app AI notifications | `ai_recommendations` (`isRead`/`isActioned`) is the notification store — no separate `Notification` model |

## Migration/RLS notes

Standard boilerplate every new table needs (tenant-column default + `GRANT` + `ENABLE ROW LEVEL SECURITY` + tenant-isolation `CREATE POLICY`), applied to: `demand_forecasts` (Chunk A), `ai_recommendations` (Chunk B — no schema change needed for the FEFO fix itself, it only changes what code writes to already-RLS'd `product_batches`/`sale_items`/`stock_movements` columns), `supplier_evaluations` (Chunk C — no RLS change needed for the `Supplier.rating` write, `suppliers` is already RLS'd). Chunk D adds no new tables. The `worker`/`realtime` processes both use the same RLS-restricted `app_user` Prisma client (`src/lib/prisma.ts`) every Next.js route already uses — no new DB role, no RLS bypass. The Python service is never given a Postgres connection string at all, enforced by omission from its `docker-compose.yml` env.

## Verification plan (this phase: consolidated at the end, not per chunk)

Build all four chunks first (schema, services, routes, frontend for A, then B, then C, then D), with a local commit after each chunk lands so git history still reflects the chunk boundaries. Once D is built, bring up the full stack (`docker compose up`, confirm `app`/`postgres`/`redis`/`python-ai`/`worker`/`realtime` are all healthy via `docker compose ps`) and run one comprehensive live-verification pass covering all of Phase 5 end-to-end: trigger a real forecast run through to completion, confirm reorder/EOQ/waste recommendations compute from it, run a real AHP→TOPSIS/PROMETHEE supplier evaluation, run a scenario simulation, confirm the recommendations feed + Socket.io toast + dashboard all reflect everything above. Independently sanity-check computed numbers against hand-computed or `psql`-verified expectations — not just "does it render." Fix any real bugs found. Only after verification passes: push to `origin/main` and write the four chunks' dated `Dev Log.md` entries.

## Critical files

- `prisma/schema.prisma` — new models/enums for all 4 chunks
- `docker-compose.yml` — new `python-ai`/`worker`/`realtime` services
- `src/lib/prisma.ts` — `withTenant`, the 5s-timeout lesson every async job handler must respect
- `src/server/services/sales.ts` — Chunk B's FEFO touch (reaches into shipped Phase 2 code)
- `prisma/seed.ts` — `PERMISSION_CATALOG.ai` already has `ai:view_recommendations`/`ai:run_forecast`; adds `suppliers:evaluate` + role gap-fixes
- `PHASE4_FINANCE_PLAN.md` — structural template this doc mirrors
