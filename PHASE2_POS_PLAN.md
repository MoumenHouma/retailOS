# Phase 2 Implementation Plan — Point of Sale

> Companion to [[ROADMAP]] (source of truth for week numbers/exit criteria), [[ARCHITECTURE]] (module spec, screen mockup, offline strategy) and [[DATABASE]] (schema). See [[Dev Log]] for how Phases 0-1 actually went.

## How to use this doc

Phase 2 (roadmap weeks 6-9) is broken into **four chunks** below, each sized to be one dev session — the same granularity Phase 0 (scaffold) and Phase 1 (products/inventory/suppliers) were each closed out in. Each chunk lists the schema, services/routes, and UI to build, reusing the exact conventions already established in Phase 0-1 code (named explicitly below so a session doesn't have to re-derive them). **Do the chunks in order** — each depends on the previous one's schema (see Sequencing notes at the end). Close out each chunk with a new dated entry in `Dev Log.md`, same pattern as before.

Several architectural decisions Phase 2 needs are made *in this document* so no session has to re-litigate them — they're called out inline as "**Decision:**".

---

## Chunk A — POS Core (roadmap Week 6)

**Goal:** a cashier can open a session, ring up a sale with a single payment method, and close the session — with real stock movements, no returns/invoicing/offline yet.

### Schema

New Prisma models (field lists taken verbatim from `DATABASE.md` §7.1-7.3, §7.6-7.7, §10.1 — converted to this project's camelCase + `@map` + `dbgenerated("NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid")` tenant-id convention, same as every Phase 1 model in `prisma/schema.prisma`):

- `Customer` — minimal for this chunk: `id, tenantId, name, phone, customerType (default walk_in), isActive, timestamps, deletedAt`. Full CRM fields (loyalty, debt, segmentation) deferred to whichever later phase needs them — Phase 2 only needs "who is this sale for."
- `PosSession` (`pos_sessions`) — `storeId, cashierId, terminalName, openedAt, closedAt, openingCash, closingCash, expectedCash, cashDifference, totalSales, totalRefunds, status`. Enum `PosSessionStatus { open closed }`.
- `PosCashMovement` (`pos_cash_movements`) — `sessionId, movementType, amount, reason, createdBy, createdAt`. Enum `CashMovementType { OPENING CLOSING WITHDRAWAL DEPOSIT ADJUSTMENT }`.
- `Sale` (`sales`) — `storeId, saleNumber, posSessionId, customerId, cashierId, subtotal, discountAmount, tvaAmount, taxStampAmount, total, totalPaid, changeDue, status, isOffline, syncedAt, notes`. Enum `SaleStatus { completed voided held }`.
- `SaleItem` (`sale_items`) — `saleId, productId, productName, productBarcode, quantity, unitPrice, costPrice, tvaRate, discountAmount, subtotal, tvaAmount, total, batchId` (batchId stays null — `product_batches` doesn't exist until Phase 3, same as `StockMovement.batchId` today).
- `SalePayment` (`sale_payments`) — `saleId, paymentMethod, amount, reference, createdAt`. Enum `PaymentMethodType { CASH CARD CHECK TRANSFER MIXED }`.

**Decision:** `ARCHITECTURE.md` §4.4 lists a separate `sale_discounts` table; `DATABASE.md` §7's concrete schema doesn't have one — discount lives directly on `sales.discountAmount` (ticket-level) and `sale_items.discountAmount` (per-line). The two source docs disagree; **`DATABASE.md`'s concrete column list wins** since it's the one with an actual schema. Don't add a `sale_discounts` table.

`Sale.saleNumber` is sequential per store — use `Store.posPrefix` (already reserved, default `"POS"`) as the prefix, e.g. `POS-000042`. Simplest correct approach: a per-store counter, same "hand-append a DB sequence/trigger Prisma can't express" pattern already used for RLS/GENERATED columns elsewhere in this schema — don't try to derive it from `COUNT(*)` (races under concurrent cashiers).

### Services & routes

- `src/server/services/pos-sessions.ts` — `openSession(tx, {storeId, cashierId, terminalName, openingCash})` (reject if cashier already has an open session on that terminal), `closeSession(tx, {sessionId, closingCash})` (computes `expectedCash = openingCash + cash sales - cash refunds + deposits - withdrawals`, sets `cashDifference`), `recordCashMovement(tx, {...})`.
- `src/server/services/sales.ts` — `completeSale(tx, input)`: one `withTenant` transaction that creates `Sale` + `SaleItem[]` + `SalePayment[]`, and for each line calls the **existing** `recordStockMovement` from `src/server/services/stock.ts` with `movementType: "SALE_OUT"`, `referenceId: sale.id`, `referenceType: "sale"` — this is exactly the extension point that function's doc comment anticipates. Reject with a new `SessionClosedError` if there's no open `PosSession` for the cashier/terminal. Let `InsufficientStockError` (already exists, already mapped) propagate naturally if a line oversells.
- New error classes (`SessionClosedError`, `SessionAlreadyOpenError` in `pos-sessions.ts`) registered in `src/lib/service-errors.ts`'s `mapServiceError` switch, same pattern as the existing five error classes there.
- Routes, all following the `requirePermission` → Zod `safeParse` → `withTenant` → `apiSuccess`/`mapServiceError` skeleton from `src/app/api/products/route.ts`:
  - `POST /api/pos/sessions` (open), `GET /api/pos/sessions` (current/history), `POST /api/pos/sessions/[id]/close`
  - `POST /api/pos/sessions/[id]/cash-movements`
  - `POST /api/pos/sales`
  - `GET /api/customers`, `POST /api/customers` (minimal create — walk-in is the default, not every sale needs a real customer record)
  - Permissions: `pos:operate` (session/sale routes), `pos:discount` (line/ticket discounts), `pos:open_drawer` (cash movements) — **all already seeded** in `prisma/seed.ts`'s permission catalog, just unused until now. `customers:read`/`customers:create` likewise (add `customers:create` to the seed if it's missing — the seed currently only lists `customers:read`).

### Frontend

- New route group `src/app/[locale]/(pos)/pos/page.tsx` — **deliberately outside `(dashboard)`**, no sidebar: `ARCHITECTURE.md`'s §4.4 mockup is a dedicated full-screen terminal layout, not a dashboard content pane. Wires up the sidebar's existing unlinked `<span>Point de vente</span>` placeholder in `src/app/[locale]/(dashboard)/layout.tsx` into a real link.
- Cart state: **Decision** — Zustand (already a dependency, currently unused anywhere in the app) for the in-progress cart, not TanStack Query — it's ephemeral client-only UI state until checkout POSTs it.
- New shadcn primitives needed (none of these exist in `src/components/ui/` yet, confirmed): `alert-dialog` (void-sale confirmation), `card`, `separator`. Products/quantity/payment components follow the existing `*-view.tsx` / `*-form-dialog.tsx` split used by `src/components/suppliers/`.
- New i18n namespace `pos.*` (session, cart, payment, shortcuts) added to all three of `src/i18n/{fr,en,ar}.json`, same nesting convention as the existing `suppliers.*` namespace.
- Keyboard shortcuts from `ARCHITECTURE.md` §4.4's table (F1 search, F4 discount, F5 payment, F12 complete, Esc cancel) — F3 (hold) and F6 (return) are stubbed/disabled in this chunk, wired up in Chunk B.

### Exit criteria

Cashier opens a session → searches/scans a product into the cart → applies a discount → pays with one method → completes the sale (real `SALE_OUT` stock movements land in `stock_movements`, `stock_levels` updates via the existing trigger) → closes the session and sees a computed cash difference. No returns, no invoice, no offline.

---

## Chunk B — Transaction Flow (roadmap Week 7)

**Goal:** sale completion is a proper transaction (already true from Chunk A), plus returns, held sales, shift reports, and sale history.

### Schema

- `SaleReturn` (`sale_returns`) — `storeId, originalSaleId, returnNumber, reason, totalRefunded, status, createdBy`. Enum `ReturnStatus { pending completed cancelled }`.
- `SaleReturnItem` (`sale_return_items`) — `returnId, saleItemId, productId, quantity, unitPrice, tvaRate, refundAmount, reason`.
- If Chunk A shipped with only `CASH`/`CARD` wired in the UI, this chunk is where `CHECK`/`TRANSFER`/`MIXED` (multi-payment split) get full UI support — the enum itself is already complete from Chunk A.

### Services & routes

- `src/server/services/returns.ts` — `createReturn(tx, input)`: validates each returned line against `SaleItem.quantity` minus any prior returns on that line (can't return more than was sold), calls `recordStockMovement` with `movementType: "RETURN_IN"`, `referenceType: "sale_return"`.
- Held sales: no new table — `Sale.status = "held"` on create, stock is **not** moved for a held sale until it's recalled and completed (only call `recordStockMovement` at completion, not at hold time).
- X/Z report: a read aggregation in `pos-sessions.ts` (`getSessionReport(tx, sessionId)`) summing `Sale`/`SalePayment`/`PosCashMovement` for the session — no new table, just a query.
- Routes: `POST /api/pos/sales/[id]/return`, `GET /api/pos/sessions/[id]/report`, `GET /api/pos/sales` (history, search/filter/paginate).

### Frontend

- Sale history list page reusing the `suppliers-view.tsx` pattern (search/filter/sort/pagination via TanStack Query + manual fetch).
- Hold/recall UI in the POS screen (F3), return flow (F6) — both were stubbed in Chunk A.
- X/Z report view (printable summary).

### Exit criteria

Matches `ROADMAP.md` Week 7 verbatim: sale → stock movement → stock update happens inside one transaction (already true since Chunk A); returns/refunds work; held transactions can be recalled; X/Z reports available; sale history is searchable.

---

## Chunk C — Invoicing (roadmap Week 8, DÉCRET 05-468)

**Goal:** generate a legally compliant invoice PDF from a completed sale.

### Schema

- `Invoice` (`invoices`) — full field list per `DATABASE.md` §9.1: `invoiceNumber, saleId, customerId, customerName/Address/Nif (snapshots), issueDate, dueDate, subtotal, discountAmount, tvaAmount, tvaDetails (Json), taxStampAmount, totalTtc, netToPay, amountInWords, paymentTerms, status, pdfUrl`. Enum `InvoiceStatus { draft issued paid partially_paid overdue cancelled }`.
- `InvoiceItem` (`invoice_items`) — per `DATABASE.md` §9.2.
- `InvoiceSequence` — per-tenant gapless counter (`tenantId PK, lastNumber, year`), per `DATABASE.md` §9.1's explicit call-out that invoice numbers must be sequential with no gaps.

### Services & routes

- `src/server/services/invoices.ts` — `generateInvoice(tx, saleId)`:
  - Locks and increments `InvoiceSequence` **inside the same transaction** using `tx.$queryRaw` with `SELECT ... FOR UPDATE` (Prisma has no native row-lock API — this is the same "hand-append what Prisma can't express" pattern already used for RLS policies and the `fn_apply_stock_movement` trigger elsewhere in this codebase). Format: `YYYY-NNNNN`, resets when `year` changes.
  - Computes `tvaDetails` by grouping `SaleItem`s by `tvaRate` (matches `DATABASE.md`'s `{"19": amount, "9": amount, "0": amount}` shape).
  - Tax stamp: `max(100, round(totalTtc * 0.01))` — formula given verbatim in `ARCHITECTURE.md` §4.7.
  - Amount-in-words (French): **Decision** — no suitable npm package confirmed for French number-to-words; write a small hand-rolled helper (`src/lib/number-to-french-words.ts`), it's a bounded, testable pure function (numbers up to a few million DZD), not worth a dependency.
- **Decision — PDF generation library: `@react-pdf/renderer`.** Rationale: lets the invoice layout be written as JSX matching the `ARCHITECTURE.md` §4.7 mockup directly; runs in the Node/Next.js runtime without a headless-browser dependency (ruling out Puppeteer — heavier, and this project's Docker dev setup has already hit enough container-flakiness gotchas per `Dev Log.md` to avoid adding one more moving part). Generated PDF uploads to the **existing** MinIO `retailos` bucket (provisioned in `docker-compose.yml`, unused since Phase 0) via the S3 env vars already present in `.env.example`.
- Routes: `POST /api/invoices` (from a `saleId`), `GET /api/invoices/[id]/pdf` (stream/redirect to the stored PDF), `GET /api/invoices` (list/search).

### Frontend

- Invoices list page (same list pattern as before).
- "Générer facture" action on a completed sale (in sale history / POS receipt screen) → downloads/previews the PDF.

### Exit criteria

Matches `ROADMAP.md` Week 8: invoice generated from a sale with correct sequential numbering (no gaps, even under concurrent sales), all DÉCRET 05-468 mandatory fields populated from the tenant record, correct TVA/tax-stamp math, PDF generated and stored, invoice listing/search works.

---

## Chunk D — Offline & Polish (roadmap Week 9)

**Goal:** POS works without internet and syncs cleanly on reconnect; performance polish.

### New dependency

**Dexie.js** — named explicitly in `ARCHITECTURE.md` §7.1 as the intended IndexedDB wrapper. Local tables per that section: `local_products`, `local_sales`, `local_stock_levels`, `local_payments`, `local_settings`.

### Sync design (per `ARCHITECTURE.md` §7.2-7.3 — implement as specified, don't redesign)

- Online: periodic pull every 5 min (product/price updates), immediate push on every sale, immediate push on every stock change.
- Offline: sales write to `local_sales` with a local id, stock decremented optimistically in `local_stock_levels`, "Offline Mode" indicator shown, `navigator.onLine` + a heartbeat ping used to detect the transition.
- Reconnect: push the queued sales **in order**; for each, server validates stock — success confirms the sale server-side, a stock conflict is flagged for the cashier to resolve (remove item / adjust), a price-changed conflict lets the cashier choose old vs. new price. Server is authoritative for stock in every case. All conflicts logged.

**Decision — Redis stays unused for this.** `docker-compose.yml` has had a running, healthy Redis container since Phase 0 that nothing in `src/` references yet. `ARCHITECTURE.md`'s offline design is a **client-side** queue pushed directly to the API on reconnect, not a server-side broker/queue — so Redis isn't needed for Phase 2's offline sync as specified. Flagging this explicitly so the session that starts this chunk doesn't spend time wiring Redis in before checking whether the design actually calls for it (re-confirm against `ARCHITECTURE.md` §7 at the time, in case priorities shifted).

### Also in this chunk (Week 9 polish, per roadmap)

- Sub-500ms transaction performance pass on the POS checkout path.
- Error-recovery/conflict-resolution UI for the sync cases above.

### Exit criteria

Matches `ROADMAP.md` Week 9: cashier can complete sales with no network, sales sync automatically and in order on reconnect, conflicts surface to the cashier instead of silently failing, checkout is fast.

---

## Sequencing notes

Do the chunks in order — each builds on the previous one's schema:
- Chunk B's returns/reports reference `Sale`/`SaleItem`/`PosSession` from Chunk A.
- Chunk C's invoices reference completed `Sale`s from Chunk A/B.
- Chunk D's offline sync needs the online sale-completion path (Chunk A) to be solid and stable before adding a client-side queue on top of it — debugging sync conflicts against a still-changing server API would be needlessly painful.

Close out each chunk with a new dated entry in `Dev Log.md` (bugs found, environment gotchas, what's still open) — same format as the existing 2026-07-08 and 2026-07-09 entries.
