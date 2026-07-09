# Dev Log

Running log of work sessions on RetailOS. Newest entries at the top. See [[ROADMAP]] for the phase plan, [[ARCHITECTURE]] and [[DATABASE]] for the design this work follows.

---

## 2026-07-09 — Phase 1 UI: suppliers, products, inventory, catalog management

**Done:**
- Finished the suppliers API surface (list/create/update/soft-delete, contacts, product links, performance) that a prior session's backend work had left unrouted — brands/products/units already had full CRUD routes, suppliers didn't.
- Built the Suppliers list page (search, active/inactive filter, sort, pagination, create dialog, soft-delete). First real data-fetching UI in the app; established the pattern (shadcn Table/Dialog/Form/Select + TanStack Query) every later page reuses.
- Built the Products list page on the same pattern, plus a create dialog (unit/category/brand selects, DA pricing, VAT rate).
- Built the Inventory page: tabbed **Stock levels** / **Movements**, low-stock filter, a stock-adjustment dialog (direction, quantity, required reason) wired to the existing trigger-maintained `stock_levels` table.
- Added **Categories / Brands / Units** as management tabs on the Products page (list, create, delete) — these were API-only before, so the product form's dropdowns had no way to get populated short of hand-crafting requests.
- Filled in the shadcn/Tailwind v4 theme tokens (`secondary`, `accent`, `destructive`, `popover`, `input`, `ring`) in `globals.css` — the scaffolded UI primitives referenced them but they were never defined, so buttons/selects/dialogs would have rendered unstyled.
- Mounted the Sonner `<Toaster>` (component existed, was never added to the provider tree).
- Added **edit UI** for products and suppliers: the create dialogs (`ProductFormDialog`, `SupplierFormDialog`) now take an optional `product`/`supplier` prop and switch between POST-create and PATCH-update — a pencil-icon button per row opens the same dialog pre-filled. Both PATCH routes already existed; only the UI was missing.
- Added **CSV/Excel import-export UI** for products: "Exporter (CSV)"/"Exporter (Excel)" buttons (plain `<a>` downloads, not client routing — the response is a file, not a page), and an "Importer" dialog that previews the parsed rows (valid/error counts, per-row error detail) before a separate confirm step commits only the valid rows.
- Added **multi-barcode management UI**: a barcode-icon button per product row opens a dialog listing all barcodes for that product (type, primary badge), with add/set-primary/remove actions wired to the existing `/api/products/[id]/barcodes[/[barcodeId]]` routes.
- Added **supplier-product linking UI**: a link-icon button per supplier row opens a dialog listing products supplied by that supplier (supplier SKU, unit price, min order qty, preferred badge) with link/set-preferred/remove actions. Added `GET /api/suppliers/[id]/products` + `listSupplierProducts` — the route only had POST before, so there was no way to list *existing* links, which a management UI can't work without.
- Verified every page live in a real browser (Playwright-driven headless Chromium) against the Dockerized dev stack — not just typecheck/lint.

**Bugs found and fixed during verification:**
- `parseAndValidateImportRows` (`src/server/services/product-import.ts`) read CSV uploads via `XLSX.read(buffer, { type: "array" })`, which without an explicit UTF-8 BOM can mis-decode accented headers — so a CSV missing a BOM (e.g. hand-edited in a plain text editor) silently failed to match the `Unité`/`Catégorie` columns, surfacing as a spurious "Required" error on every row. Fixed by detecting zip-format (xlsx/xls, unicode-safe by construction) via the "PK" signature and explicitly UTF-8-decoding everything else before parsing.
- No units existed for either demo tenant, and `unitId` is required on every product — product creation was a dead end. Seeded 4 default units (Pièce/Kilogramme/Litre/Carton) per tenant in `prisma/seed.ts`.
- `src/app/api/products/export/route.ts` passed a Node `Buffer` straight to `NextResponse` — not valid `BodyInit`, a real typecheck failure nobody had caught. Fixed with `new Uint8Array(buffer)`.
- `getStockLevels` (`src/server/services/stock.ts`) computed `isLowStock` in JS *after* paginating in SQL — the low-stock-only view could show a stale non-zero total against an empty page, or silently drop/misplace rows outside the current page. Fixed by fetching all matching rows and paginating post-filter (fine at Phase 1 catalog sizes; revisit if a tenant's catalog gets large).
- Added `GET /api/stores` (minimal, read-only) — nothing exposed the store list, needed for Inventory's store selectors.

**Environment gotchas (worth remembering if they resurface):**
- Docker Desktop repeatedly went into a "manually paused" resource-saver state, and separately the dev-server container sometimes degraded badly after many hot-reload cycles (requests taking 20–40s). `docker desktop restart` (CLI) and/or `docker compose restart app` reliably fixed both — don't chase it as a code bug first.
- Editing a file *imported by* an API route (not the route file itself) doesn't always trigger Next dev's route recompilation — a fix to `stock.ts` kept serving stale logic through `/api/stock-levels` until the app container was restarted. Restart after backend-only edits if a fix doesn't seem to take.
- Playwright + Radix Dialog: the first click on a `DialogTrigger` can already open the dialog while Playwright's own actionability retry doesn't recognize it (sees the new overlay as "intercepting" the trigger and keeps retrying for the full timeout). Use `force=True` on dialog-trigger clicks in test scripts.
- Next dev's on-demand compilation can race an in-flight request body: the *first* hit to a not-yet-compiled dynamic API route that carries a JSON body can fail with `SyntaxError: Unexpected end of JSON input` in `request.json()` (the body stream appears to get consumed/discarded during the compile-triggered re-invocation). Retrying the exact same request once the route is warm succeeds immediately. Only ever seen on the first body-carrying request to a given route per dev-server process — a dev-mode-only artifact, not reproducible against a production build.

**Open items for later phases:**
- Multi-store support — Inventory/adjustment UI currently assumes the single seeded "principal" store per tenant.
- Phase 1's UI-facing scope is now complete: every Phase 1 backend feature has a corresponding UI, list pages have search/filter/sort/pagination/create/edit/delete, and the roadmap's stated exit criteria (create products, organize into categories, assign barcodes, view stock levels, register/link suppliers) are all met. Next up per [[ROADMAP]] is Phase 2 (POS).

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
