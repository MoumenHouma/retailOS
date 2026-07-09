# Dev Log

Running log of work sessions on RetailOS. Newest entries at the top. See [[ROADMAP]] for the phase plan, [[ARCHITECTURE]] and [[DATABASE]] for the design this work follows.

---

## 2026-07-09 — Phase 2 Chunk C: Invoicing (DÉCRET 05-468)

**Done (per [[PHASE2_POS_PLAN]] Chunk C), continuing directly from Chunks A/B the same day:**
- Schema: `Invoice`, `InvoiceItem`, `InvoiceSequence` (+ `InvoiceStatus` enum). `InvoiceSequence` is a dedicated per-tenant table (not a reuse of `Store.saleCounter`) since invoice numbering is tenant-wide, not per-store, and resets on calendar-year rollover.
- `invoices.ts`: gapless `YYYY-NNNNN` numbering via `SELECT ... FOR UPDATE` on the sequence row (parameterized `$queryRaw`/`$executeRaw` tagged templates, not the `Unsafe` variants — same "hand-append what Prisma can't express" pattern as RLS/triggers elsewhere, but done safely this time). TVA grouped into a `tvaDetails` JSON bucket per rate; tax stamp = `max(100 DA, round(TTC × 1%))`; DÉCRET 05-468 mandatory fields (NIF/NIS/RC/AI from the `Tenant` record, TVA breakdown, amount in words) all populated.
- `src/lib/number-to-french-words.ts`: hand-rolled French number-to-words (no suitable npm package) — verified against the exact ARCHITECTURE.md spec example (9 702,50 DA → "Neuf mille sept cent deux dinars et cinquante centimes.") and spot-checked the irregular cases (quatre-vingts, soixante-dix, cent vs cents, mille not "un mille").
- `src/server/services/invoice-pdf.tsx`: `@react-pdf/renderer` document matching the ARCHITECTURE.md §4.7 mockup structurally (header, seller/buyer blocks, line-item table, totals, amount in words, payment terms). Chosen over Puppeteer specifically to avoid another headless-browser dependency in a Docker setup that's already hit enough container-flakiness gotchas.
- `src/lib/storage.ts`: MinIO client (`minio` package) — bucket already provisioned by the `minio-init` compose service since Phase 0, previously unused. PDFs stored at `invoices/{tenantId}/{invoiceNumber}.pdf`, served back through `/api/invoices/[id]/pdf` (the app proxies/streams it — no direct public bucket access).
- Frontend: "Générer facture" action on sale-history rows (becomes "Voir la facture" once one exists), new Invoices list page (`/invoices`, sidebar "Finances" now links here).

**Bugs found and fixed during verification (both real, both worth remembering):**
1. **PDF thousands-separator glyph.** `formatDa()`'s `toLocaleString("fr-FR", ...)` uses a narrow no-break space (U+202F) as the thousands separator — fine in a browser (full Unicode font fallback), but react-pdf's base Helvetica font (WinAnsiEncoding, no fallback) has no glyph for it and silently rendered `/` instead: "1 200,00" came out as "1/200,00" on every amount in the PDF. Fixed with a PDF-local `formatDa` wrapper that swaps U+00A0/U+202F for a plain space (built via `String.fromCharCode`, not a literal, to avoid the exact same invisible-character ambiguity biting the fix itself — it did, mid-session, and cost a few edit-tool round-trips before switching to `fromCharCode`). Web UI keeps the nicer non-breaking version.
2. **PDF generation inside the DB transaction.** The original `generateInvoice` rendered the PDF and uploaded it to MinIO *inside* the `withTenant` transaction. Both are slow, latency-variable operations (first-ever PDF render pays font-loading/JIT cost; MinIO upload is network I/O) that have no business holding a Postgres transaction open — it blew Prisma's default 5s interactive-transaction timeout (`Transaction already closed... 7230 ms passed`) on the very first real invoice generation. Fixed by splitting into `createInvoiceRecord` (fast, DB-only, returns the row + PDF data) → render + upload happen outside any transaction → `attachInvoicePdf` (a second, fast transaction just to set `pdfUrl`). General lesson: never do slow external I/O inside a Prisma interactive transaction, no matter how convenient "just do it all in one function" looks.

Also re-confirmed the now-familiar "editing a file imported by a route doesn't always get picked up without a container restart" gotcha — this time for `invoice-pdf.tsx`, imported by the service, imported by the route.

**Open items for later chunks:**
- Invoices are always generated as `issued` immediately — no `draft` review step, no payment-status tracking (`paid`/`partially_paid`/`overdue`) even though the schema supports it.
- Walk-in (no `Customer` record) sales invoice with `customerNif: null` — DÉCRET 05-468 compliance for fully anonymous cash sales is a known real-world gap, not addressed here.
- Next up per [[PHASE2_POS_PLAN]] is Chunk D (offline sync, Dexie.js/IndexedDB) — the roadmap's own highest-risk item.

---

## 2026-07-09 — Phase 2 Chunk B: Transaction Flow

**Done (per [[PHASE2_POS_PLAN]] Chunk B), continuing directly from Chunk A the same day:**
- Schema: `SaleReturn`/`SaleReturnItem` (+ `ReturnStatus` enum). Returns reuse `Store.saleCounter` (the same counter `Sale.saleNumber` draws from) rather than adding a second counter column — numbers interleave in issue order, disambiguated by a `-RET-` segment; nothing depends on either sequence being contiguous on its own.
- `sales.ts` refactored: pricing logic (resolve unit price/TVA/cost from the `Product` record, never trust client input) extracted into a shared `priceItems()` used by both `completeSale` and the new `holdSale`. Held tickets (F3) are a real `Sale` row with `status: "held"`, priced but with no payments and **no stock movement** — a hold never touches inventory. `recallSale` returns the held ticket's items for the client to reload into the cart, then soft-deletes the row; the eventual checkout is a fresh `completeSale()` call, not an update of the held row.
- `returns.ts`: `createReturn` validates each returned line against the sale item's original quantity minus whatever's already been returned against it (so the same item can't be over-returned across multiple partial returns), refunds proportionally from the line's actual post-discount total (not list price), and records a `RETURN_IN` stock movement per line via the existing `recordStockMovement`.
- `pos-sessions.ts`: `getSessionReport` — a read-only aggregation (sale count, gross/net sales, refunds, payments-by-method) that works identically whether the session is open (X report, mid-shift) or closed (Z report) — closing just additionally persists the totals onto the session row.
- Routes: `/api/pos/sales` (GET added for history search), `/api/pos/sales/[id]`, `/api/pos/sales/[id]/return`, `/api/pos/sales/hold`, `/api/pos/sales/held`, `/api/pos/sales/[id]/recall`, `/api/pos/sessions/[id]/report`.
- Frontend: hold/recall buttons + held-sales dialog and an X-report dialog added to the POS screen; a new **Sales History** page under the dashboard (`/sales`, new sidebar link "Ventes") with a `ReturnDialog` reusable from both the history list and (in principle) the POS screen, showing per-line remaining-returnable quantity.
- Verified live in a real browser end-to-end: hold a cart → recall it → complete the sale → view the X report → find the sale in history → process a partial return → confirmed in Postgres that the return row and its `RETURN_IN` stock movement both landed correctly.

**Bugs found and fixed during verification:** none in the app — every failure on the first few verification passes was the test script itself using timeouts too short for Next dev's on-demand compilation of freshly-added routes/pages (each brand-new route's *first* hit compiles before serving, same class of thing as Chunk A's route-cache gotcha, but showing up per-endpoint here rather than per-page). Lesson for next time: after adding new API routes in a chunk, give the *first* verification hit to each one 20-30s of margin, not the usual 10s — it's fast on every hit after that.

**Open items for later chunks:**
- Still single-payment-method checkout only; multi-payment/split (`MIXED`) UI is still not built (the schema supports it — multiple `SalePayment` rows per sale — just no UI for entering more than one).
- Next up per [[PHASE2_POS_PLAN]] is Chunk C (DÉCRET 05-468 invoicing).

---

## 2026-07-09 — Phase 2 Chunk A: POS Core

**Done (per [[PHASE2_POS_PLAN]] Chunk A):**
- Schema: `Customer` (minimal — name/phone/type, full CRM fields deferred), `PosSession`, `PosCashMovement`, `Sale`, `SaleItem`, `SalePayment`, plus `Store.saleCounter` for gapless per-store sale numbering (`POS-000001`, incremented inside the same transaction as the sale so the UPDATE's row lock serializes concurrent cashiers — no separate sequence table needed). Migration hand-edited same as every prior one: stripped Prisma's auto-generated `DROP INDEX` on the hand-added trgm index and an unwanted touch of the `stock_levels.quantity_available` generated column, added Grants + RLS policies for the six new tables.
- Services: `pos-sessions.ts` (open/close/cash-movement, `closeSession` computes `expectedCash` from opening float + cash sales + deposits − withdrawals), `sales.ts` (`completeSale` — resolves price/TVA/cost from the `Product` record server-side, never trusts client-supplied prices; calls the existing `recordStockMovement` per line with `SALE_OUT`, so an oversold line rolls the whole sale back), `customers.ts`. New error classes registered in `service-errors.ts`.
- Routes: `/api/pos/sessions[/[id]/close, /cash-movements]`, `/api/pos/sales`, `/api/customers` — all on the existing `requirePermission` → Zod → `withTenant` → `apiSuccess`/`mapServiceError` skeleton. Seeded `pos:*`/`finance:*`/`customers:read` permissions from Phase 0 were finally wired up; added `customers:create` (missing from the original catalog) and granted it to `CASHIER`.
- Frontend: new `(pos)` route group — deliberately outside `(dashboard)`, no sidebar, full-screen terminal per `ARCHITECTURE.md`'s mockup. Zustand cart store (first real use of that dependency), product search-as-you-type, cart panel with per-line/ticket discount (gated behind `pos:discount`), customer picker (search existing + quick-create), open/close session flows, single-method payment dialog, receipt dialog. Added `alert-dialog`/`card`/`separator` shadcn primitives (via the CLI — worked fine non-interactively, just took ~2 min for the registry fetch, don't mistake the wait for a hang). Wired the sidebar's long-unlinked "Point de vente" placeholder to `/pos`.
- Verified live in a real browser (Playwright, installed ad hoc into the app container and removed again afterward — not a project dependency) against the Dockerized stack: open session → search product → add to cart → increment quantity → checkout (cash) → receipt → new sale clears cart → close session with correct expected-cash/difference math. All green.

**Bugs found and fixed during verification:**
- New route additions ((pos) route group) 404'd until the app container was restarted — same "Next dev doesn't always pick up new files under the bind mount" class of issue as Phase 1's stock.ts gotcha, just for new *routes* this time rather than an imported service file. Restart after adding new route segments, not just after backend edits.
- `recordStockMovement` correctly rejected the first verification sale with `INSUFFICIENT_STOCK` — the demo tenant's products had never had any stock added (Phase 1 only ever exercised the adjustment UI manually, nothing persisted). Not a bug; seeded 50 units via a direct `PURCHASE_IN` movement to unblock verification. Worth seeding baseline stock for the demo tenants properly at some point so this doesn't surprise the next session too.
- My own verification script, not the app: Playwright's `text=` selector doesn't match `placeholder` attributes, only rendered text nodes — cost a couple of false-negative debugging loops before switching to `input[placeholder*="..."]`.

**Open items for later chunks:**
- Only single-payment-method checkout (Cash/Card/Check/Transfer) — no split/mixed payment UI, no returns, no held sales, no X/Z reports. That's Chunk B.
- Demo tenants have no baseline stock seeded — every fresh environment will hit `INSUFFICIENT_STOCK` on the first POS sale until something (adjustment UI or seed script) puts stock on the books.
- Next up per [[PHASE2_POS_PLAN]] is Chunk B (Transaction Flow: returns, held sales, X/Z reports, sale history).

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
