# RetailOS — Senior Full-Stack Performance Audit

**Repo:** `https://github.com/MoumenHouma/retailOS`
**Date:** 2026-07-11
**Stack:** Next.js 16 · React 19 · Prisma 6 · PostgreSQL 16 (with RLS) · Redis · BullMQ · Socket.io · MinIO · Python FastAPI (Prophet)
**Scale:** 63 models · 147 indexes · ~130 API routes · ~40 pages · ~50 services

---

## TL;DR

The architecture is genuinely good — Postgres row-level security done properly, FEFO batches, MCDA supplier ranking, offline-first POS with Dexie. The performance problems are concrete and fixable. In priority order:

1. **You're running it in `next dev --webpack` mode** — your own Dev Log documents 20–70s first-hit cold compiles. This is ~80% of the perceived slowness.
2. **Prisma connection pool isn't actually configured** — `DATABASE_POOL_SIZE=20` is unused; Prisma reads `?connection_limit=` from the URL.
3. **"Load everything, aggregate in JS" pattern** — `getReorderSuggestions` runs on every dashboard load with no `where` clause and 4-level include.
4. **Every API call pays 1–2 Redis round-trips** for rate-limiting before the handler runs.
5. **`withTenant` wraps every DB op in `BEGIN → SET LOCAL → … → COMMIT`** with a 5s default timeout.
6. **POS mount fires ~20 sequential `/api/products` fetches** on mount + every 5 min.
7. **`completeSale` does up to 3 sequential DB calls per line item** inside a transaction holding the store's sale counter lock.
8. **No caching anywhere** — Redis only used for BullMQ/rate-limit/Socket.io adapter.

---

## 1. 🔴 You're running in `next dev` mode (5–20× slower than prod)

`docker-compose.yml` runs `pnpm exec next dev --webpack` against `Dockerfile.dev`. Your own `Dev Log.md` line 157 documents **20–70s first-hit cold compiles, 30–40s even warm**. That's the dev server JIT-compiling every route on first hit, plus React Strict Mode double-rendering, plus source maps, plus HMR overhead. The `--webpack` flag forces the legacy bundler — Next 16's default Turbopack is dramatically faster for dev.

### Fix (2 minutes)
- **Local dev:** `next dev` (drop `--webpack`, let Turbopack kick in) — first-hit compiles drop to 1–3s.
- **Real perf testing:** `docker compose -f docker-compose.prod.yml up` — uses the real `Dockerfile` with `output: "standalone"` and runs `node server.js`. Already wired up.
- **Measure-the-real-thing:** `pnpm build && pnpm start` locally.

This is probably **80% of the perceived slowness**. Do this before touching code.

---

## 2. 🔴 The "load everything into Node, aggregate in JS" pattern

Almost every report/dashboard service does this:

```ts
// src/server/services/procurement-reports.ts — getReorderSuggestions
const levels = await tx.stockLevel.findMany({
  include: { product: { include: { supplierProducts: { include: { supplier: true } } } } },
});  // ← no `where`. Loads EVERY StockLevel + Product + SupplierProduct + Supplier for the tenant
return levels.filter(l => l.quantityOnHand <= l.product.minStockLevel);  // ← in JS
```

Same pattern in `getRevenueDashboard`, `getProfitAndLoss`, `getTvaSummary`, `getPurchaseAnalytics`, `getDeliveryPerformance`, `employee-performance.ts`, `commissions.ts` — load all matching rows into Node, then `.reduce()` / `.filter()` to aggregate. For a tenant with 10k sales over a year, you pull 10k rows across the wire and iterate them in JS instead of `SUM()` / `GROUP BY` / `date_trunc()` in Postgres.

And **`getReorderSuggestions` runs on every single dashboard page load** (`src/app/[locale]/(dashboard)/page.tsx` line 25) with no caching.

### Fixes

```ts
// Reorder: push the filter into SQL
// (cross-column comparison needs raw SQL or a generated column)
// Add a generated column `is_low_stock` maintained by the same trigger
// that maintains quantity_available, then:
tx.stockLevel.findMany({ where: { isLowStock: true } })

// Revenue dashboard: use groupBy
tx.sale.groupBy({
  by: [{ createdAt: /* date_trunc via raw */ }],
  where: { status: "completed", createdAt: { gte: from, lte: to }, storeId },
  _sum: { subtotal: true, tvaAmount: true, total: true },
  _count: true,
})

// P&L: use aggregate
tx.sale.aggregate({ where, _sum: { subtotal: true } })
tx.saleItem.aggregate({ where: { sale: where }, _sum: { quantity: true } })
```

**Quick win without rewriting every service:** wrap `getReorderSuggestions` in `unstable_cache` with a 60s TTL and `revalidateTag("stock")` — it changes only when stock movements happen.

---

## 3. 🔴 Prisma connection pool isn't actually configured

`.env.example` declares `DATABASE_POOL_SIZE=20` — **Prisma doesn't read that env var**. Prisma reads `connection_limit` from the URL query string. So your pool size is the default `num_cpus * 2 + 1` — on a 2-CPU container that's **5 connections**.

You also have **two separate Prisma clients** (`prisma` + `prismaSuperuser`), so 10 total. With `withTenant` opening a transaction per request and the dashboard page firing 7 parallel queries + reorder suggestions inside one transaction, you can saturate the pool instantly. Connection acquisition waits then pile up.

### Fix

```
DATABASE_APP_URL=postgresql://app_user:...@postgres:5432/retailos?connection_limit=20&pool_timeout=10
DATABASE_URL=postgresql://postgres:...@postgres:5432/retailos?connection_limit=5
```

Drop the unused `DATABASE_POOL_SIZE` env var. Consider lazy-init for the superuser client (only 3 call sites: register, seed, login).

---

## 4. 🟠 Every API request pays 1–2 Redis round-trips for rate-limiting

`src/proxy.ts` runs on every non-asset request. For `/api/*`:

```ts
const count = await redisConnection.incr(key);       // ← Redis hop 1
if (count === 1) await redisConnection.expire(key, WINDOW_SECONDS);  // ← Redis hop 2
```

That's **1–2 sequential Redis calls before the handler even starts**. On a 1ms Redis that's 2–5ms added to *every* API call. On a loaded Redis it's worse.

### Fixes (pick one)
- **Sliding-window Lua script** in one round-trip:
  ```lua
  local c = redis.call('INCR', KEYS[1])
  if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
  return c
  ```
- **Skip rate-limit on `GET`** for already-authenticated requests (your real abuse vector is auth + mutations, not reads).
- **In-memory token bucket** per-process for the common case, fall back to Redis for distributed coordination.

Also: `routePrefix = path.split("/").slice(0, 4).join("/")` runs on every request — minor, but could be cached or simplified.

---

## 5. 🟠 `withTenant()` adds a transaction + `SET LOCAL` round-trip to every DB call

```ts
return prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
  return fn(tx);
});
```

This is the right design for RLS — don't remove it. But every tenant-scoped operation is now: `BEGIN → SET LOCAL → …queries… → COMMIT`, with Prisma's default **5s transaction timeout** (your own Dev Log line 182 documents P2028 timeouts from this). For the heavy report services that do 5–8 sequential reads, 5s is tight even in prod.

### Fixes
- **Bump the timeout:** `prisma.$transaction(fn, { timeout: 15_000, maxWait: 10_000 })` — pass an options arg through `withTenant`.
- **Parallelize independent reads** with `Promise.all` (you've done this in some places, not all — `getTvaSummary` runs 3 queries sequentially at lines 120/131/142).
- **For read-only dashboards**, consider a read-replica connection that bypasses RLS via a pre-set `app.current_tenant_id` on the connection itself (set via `SET SESSION` at pool-acquire time, not per-transaction). Saves the BEGIN/COMMIT and the SET LOCAL round-trip.

---

## 6. 🟠 POS page fires ~20 sequential HTTP requests on mount + every 5 min

`src/hooks/use-product-catalog-sync.ts` calls `syncProductCatalog()` on POS mount and every 5 minutes. `syncProductCatalog` paginates `/api/products` 100 at a time up to **20 pages = 2000 products**, sequentially, then `db.localProducts.clear()` + `bulkPut(2000)` in IndexedDB.

Each of those 20 requests goes through: proxy (Redis×2) → `auth()` JWT decode → `withTenant` (BEGIN+SET_LOCAL) → `searchProducts` (findMany + count) → COMMIT. Then the client rebuilds the entire Dexie table. **On every POS mount.**

### Fixes
- Add an `If-None-Match`/`ETag` or `?updatedSince=<timestamp>` to `/api/products` — Dexie keeps the local copy, you only fetch deltas. 2000 products → ~5 changed rows.
- Or push the sync to a service worker so it doesn't block POS mount.
- At minimum: stagger the sync to fire *after* first paint, not during. Right now it competes with the session fetch and product search.

---

## 7. 🟠 `completeSale` holds a row lock for N×3 sequential queries

In `src/server/services/sales.ts`, `completeSale` does `nextSaleNumber` (which `UPDATE`s `Store.saleCounter` → row lock) **then** for each line: `consumeExpirableBatch` (a `findMany` + N `update`s in a loop) + `saleItem.update` + `recordStockMovement`. A 10-item sale = up to **30 sequential DB calls** inside one transaction, holding the store's sale counter lock the whole time. Two cashiers on the same store serialize completely.

### Fixes
- `consumeExpirableBatch` could be one `UPDATE … WHERE id IN (…) ORDER BY expiration_date ASC` (Postgres supports `UPDATE … FROM (SELECT …)` with CTEs) instead of a JS loop.
- Batch the `SaleItem.update` calls into one `updateMany` or skip them by setting `batchId` in the original nested `items: { create: itemsData }` (you'd need to compute batchIds up front, before the sale.create).
- `recordStockMovement` for N items could be one `createMany` instead of N `create`s.

---

## 8. 🟡 No caching layer anywhere

You have Redis. You use it for BullMQ, rate-limiting, and Socket.io adapter. **Nowhere do you cache DB reads.** No `unstable_cache`, no `revalidateTag`, no response-level `Cache-Control` on `GET /api/*`. Every dashboard load recomputes everything from scratch.

### Quick wins
- `unstable_cache(getReorderSuggestions, ["reorder", tenantId], { revalidate: 60, tags: ["stock", `stock:${tenantId}`] })` — and call `revalidateTag("stock:tenant-x")` from `recordStockMovement`.
- `unstable_cache(getPermissionCatalog, ["permissions"], { revalidate: 300 })` — permissions change rarely.
- For server components, `fetch(url, { next: { revalidate: 60, tags: [...] } })` on internal API calls.
- HTTP `Cache-Control: private, max-age=15, stale-while-revalidate=60` on `GET /api/products`, `/api/customers` list endpoints.

---

## 9. 🟡 Dashboard shell overhead

`src/app/[locale]/(dashboard)/layout.tsx` renders `RecommendationsBell` on every dashboard page. That component:
- Calls `useAiNotifications()` → fires `fetch("/api/ai/realtime-token")` + opens a Socket.io connection on every dashboard mount
- Polls `/api/ai/recommendations` every 60s with `refetchInterval`

For a user navigating between 10 dashboard pages, the socket disconnects/reconnects every navigation. Either lift this to a higher level (root layout) so it survives navigation, or use `staleTime: 5 * 60 * 1000` on the query and skip the socket until the bell is opened.

---

## 10. 🟡 Minor but worth fixing

- **`assertBelongsToTenant`** (`products.ts` line 30) does 3 extra `findUnique` round-trips per product create (unit, category, brand). Could be one `findMany` with `OR`, or trust the FK + catch the `P2003` error.
- **`searchProducts`** does `include: { category, brand, unit }` — 3 joins — on every list fetch. If the product list page doesn't show brand/unit, use `select` to drop them.
- **`searchSales`** does `include: { items, payments, customer, invoices }` on every list row. For a 25-row page that's fine, but use `select` for list views.
- **`@sentry/nextjs` is bundled but probably never used in dev** — the SDK still wraps fetch and adds overhead. Disable in non-prod.
- **Two Prisma clients** = double the connection pool. The superuser client only has 3 legit call sites — lazy-init it.
- **No `runtime = "nodejs"` declaration on API routes** — Next 16 may default some to Edge, which would break `withTenant` (Prisma is Node-only). Worth verifying with `next build`'s route tree output.

---

## Priority Action Plan

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Switch to `next dev` (Turbopack) for dev, or use `docker-compose.prod.yml` for real perf testing | 5 min | 🔴🔴🔴 |
| 2 | Fix Prisma pool: append `?connection_limit=20&pool_timeout=10` to both DB URLs | 2 min | 🔴🔴 |
| 3 | Wrap `getReorderSuggestions` in `unstable_cache` + `revalidateTag("stock")` | 15 min | 🔴🔴 |
| 4 | Rewrite `getReorderSuggestions` / revenue / P&L / TVA with SQL `aggregate`/`groupBy` | 2–3 h | 🔴🔴 |
| 5 | Move `RecommendationsBell` socket + interval up to root layout | 30 min | 🟠 |
| 6 | Fix product-catalog sync: `?updatedSince=` delta fetch | 1–2 h | 🟠 |
| 7 | Collapse `completeSale`'s per-item loop into batched `createMany`/`updateMany` | 1 h | 🟠 |
| 8 | Bump `withTenant` transaction timeout to 15s + parallelize `getTvaSummary` reads | 15 min | 🟠 |
| 9 | Rate-limit: single Lua-script round-trip, skip `GET` for authed users | 30 min | 🟡 |
| 10 | Add `Cache-Control` headers + `unstable_cache` for permission catalog | 30 min | 🟡 |

**Do #1, #2, #3 first** — ~25 minutes and probably fixes 70% of what you're feeling. Then #4 is the big rewrite that pays off at scale. The rest is polish.

---

## Key File References

| Concern | File |
|---|---|
| Dev mode config | `docker-compose.yml` (line ~89: `command: pnpm exec next dev --webpack`) |
| Prod config (unused) | `docker-compose.prod.yml`, `Dockerfile` |
| Prisma client setup | `src/lib/prisma.ts` |
| Tenant-scoped transactions | `src/lib/prisma.ts` → `withTenant()` |
| Rate limiting | `src/proxy.ts` |
| Dashboard reorder query | `src/app/[locale]/(dashboard)/page.tsx` line 25 |
| Reorder service | `src/server/services/procurement-reports.ts` → `getReorderSuggestions` |
| Report aggregation | `src/server/services/financial-reports.ts` |
| POS catalog sync | `src/hooks/use-product-catalog-sync.ts`, `src/lib/product-cache-sync.ts` |
| Sale completion | `src/server/services/sales.ts` → `completeSale` |
| Realtime bell | `src/components/ai/recommendations-bell.tsx`, `src/hooks/use-ai-notifications.ts` |
| Auth (JWT) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Schema + indexes | `prisma/schema.prisma` |
| Documented perf issues | `Dev Log.md` lines 44, 110, 141, 156, 157, 182 |

---

*Audit performed by direct code inspection of the cloned repo. No runtime profiling was done — recommend running `autocannon` (already in devDependencies) against `next start` to quantify before/after.*
