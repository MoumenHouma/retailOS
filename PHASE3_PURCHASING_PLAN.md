# Phase 3 Implementation Plan — Purchasing & Warehousing

> Companion to [[ROADMAP]] (source of truth for week numbers/exit criteria), [[ARCHITECTURE]] (module spec, data flow) and [[DATABASE]] (schema). See [[Dev Log]] for how Phases 0-2 actually went, and [[PHASE2_POS_PLAN]] for the sibling doc this one is modeled on.

## How to use this doc

Phase 3 (roadmap weeks 10-13) is broken into **four chunks** below, each sized to be one dev session — same granularity as [[PHASE2_POS_PLAN]]'s Chunks A-D. Each chunk lists the schema, services/routes, and UI to build, reusing the exact conventions already established across Phases 0-2 (named explicitly below). **Do the chunks in order** — see Sequencing notes at the end. Close out each chunk with a new dated entry in `Dev Log.md`, same pattern as every phase so far.

Several decisions this doc needs to make on its own — because the source docs disagree with each other, or simply don't specify a schema that the roadmap still requires — are called out inline as **`Decision:`**. Read them; they're there so a later session doesn't have to re-derive the same call.

### A note on doc trust, going in

`DATABASE.md` §6 ("Inventory Tables") already fully specifies `stock_transfers`, `stock_transfer_items`, `stock_counts`, `stock_count_items`, and `product_batches` as if they were Phase 1 deliverables. **They are not built.** Confirmed by grepping the live schema: no `StockTransfer`, `StockCount`, or `ProductBatch` Prisma model exists anywhere, and `StockMovement.batchId`/`SaleItem.batchId` are both pre-wired nullable columns whose code comments say outright: *"product_batches doesn't exist until Phase 3."* Treat `DATABASE.md` §6.3-6.6 and §5.6 as **fully-specified schema ready to implement**, not as evidence something already exists — this phase is where they actually get built.

---

## Chunk A — Purchasing Core (roadmap Week 10)

**Goal:** a store manager can create a purchase order, get it approved, and send it to a supplier — with line items priced off that supplier's existing catalog and comparable against other suppliers' quotes.

### Schema

- `PurchaseOrder` (`purchase_orders`) — per `DATABASE.md` §8.4 verbatim: `poNumber, supplierId, storeId, status, orderedAt, expectedDeliveryDate, notes, subtotal, tvaAmount, total, currency (default "DZD"), createdBy, approvedBy`, soft-delete. Enum `PoStatus`.
  **Decision:** `PoStatus` values are `draft, pending_approval, approved, ordered, partially_received, received, cancelled` — matching `DATABASE.md`'s concrete `po_status_enum` exactly. ARCHITECTURE.md's status list and its §5.2 flow diagram both show a `CLOSED` state after `RECEIVED` that doesn't exist in the actual enum — same class of doc-disagreement Phase 2 hit with `sale_discounts`, resolved the same way (concrete schema wins). `received` is the terminal success state; there is no separate "closed."
- `PurchaseOrderItem` (`purchase_order_items`) — per `DATABASE.md` §8.5 verbatim: `poId, productId, quantityOrdered, quantityReceived (default 0), unitPrice, tvaRate, subtotal, tvaAmount, total, notes`.
- **Decision — `Store.poCounter`**: a new `Int @default(0)` field on `Store`, same pattern as the existing `saleCounter` (incremented inside the same transaction as the PO it numbers, row-lock serializes concurrent creators). Format `PO-000001`. Chosen over an `InvoiceSequence`-style dedicated table because `purchase_orders.store_id` is `NOT NULL` — POs are store-scoped, not tenant-wide, so the simpler per-store counter fits (the `InvoiceSequence` table exists specifically because invoice numbering is tenant-wide and year-aware; neither applies here).
- **Net-new (not in `DATABASE.md` — ARCHITECTURE.md names these in its data model, Week 10 requires "supplier quote comparison," but no columns are specified anywhere)**: `SupplierQuote` (`id, tenantId, supplierId, status ["pending","received","expired"], validUntil, notes, createdAt`) and `SupplierQuoteItem` (`quoteId, productId, quantity, unitPrice`). Kept deliberately minimal — just enough to request/record a quote per supplier and compare unit prices for the same product set side by side. No link back to a specific `PurchaseOrder` (a quote informs a future PO's pricing, it isn't owned by one).

### Services & routes

- `src/server/services/purchase-orders.ts`:
  - `nextPoNumber(tx, storeId)` — identical shape to `sales.ts`'s `nextSaleNumber`: `tx.store.update({ where: { id: storeId }, data: { poCounter: { increment: 1 } } })`, format `PO-${String(counter).padStart(6, "0")}`.
  - `createPurchaseOrder(tx, input)` — validates `supplierId`/`storeId` via `assertBelongsToTenant` (extend its `model` union in `src/server/services/products.ts`, or add a local copy scoped to this service — match whichever the codebase's actual current shape supports at implementation time), prices each line from `SupplierProduct.unitPrice` for that supplier+product if the caller doesn't override it, computes subtotal/tva/total the same way `sales.ts`'s `priceItems` does. Status starts `draft`.
  - `updatePurchaseOrder(tx, id, input)` — only while `draft` or `pending_approval`.
  - `submitForApproval(tx, id)` — `draft` → `pending_approval`.
  - `approvePurchaseOrder(tx, id, approverId)` — `pending_approval` → `approved`, stamps `approvedBy`. Route requires `purchases:approve`.
  - `markOrdered(tx, id)` — `approved` → `ordered`, stamps `orderedAt`.
  - New error classes: `InvalidPoStatusTransitionError` (422), registered in `service-errors.ts` same as every prior chunk's new errors.
- `src/server/services/supplier-quotes.ts`: `createQuote`, `listQuotesForProducts(tx, productIds, supplierIds?)` returning a supplier×product price matrix for the comparison view.
- Routes, all on the `requirePermission → Zod safeParse → withTenant → apiSuccess/mapServiceError` skeleton from `src/app/api/products/route.ts`:
  - `POST/GET /api/purchase-orders`, `GET/PATCH /api/purchase-orders/[id]`, `POST /api/purchase-orders/[id]/submit`, `POST /api/purchase-orders/[id]/approve` (permission `purchases:approve`), `POST /api/purchase-orders/[id]/order`.
  - `POST/GET /api/supplier-quotes`, `GET /api/supplier-quotes/compare?productIds=...`.
  - Permissions: `purchases:read`/`purchases:create`/`purchases:approve` — **already seeded** in `prisma/seed.ts`, `BUSINESS_OWNER`/`STORE_MANAGER` already have all three. No seed change needed for this chunk.

### Frontend

- New dashboard page `src/app/[locale]/(dashboard)/purchase-orders/page.tsx` + `src/components/purchasing/purchase-orders-view.tsx` — same list pattern as `suppliers-view.tsx` (search/filter/sort/pagination via TanStack Query, `{data, meta}` shape).
- `PurchaseOrderFormDialog` (or a dedicated page, given line-item editing is heavier than the single-dialog forms used so far — decide based on how unwieldy the supplier→product-list flow feels once building it, same judgment call Phase 2 made between dialog-based and page-based flows): supplier picker, then item rows pre-filled from that supplier's `SupplierProduct` catalog with editable quantity/price.
- Approve button visible only when `session.user.permissions.includes("purchases:approve")`, same gating pattern as `pos:discount`/`pos:refund` throughout Phase 2.
- `SupplierQuoteComparisonView` — pick a product (or set of products), show each supplier's quoted unit price side by side.
- i18n namespace `purchaseOrders.*` / `supplierQuotes.*` added to all three of `src/i18n/{fr,en,ar}.json`, same nesting convention as `sales.*`/`invoices.*`.
- Wire the sidebar's existing "Achats" placeholder `<span>` (in `src/app/[locale]/(dashboard)/layout.tsx`) into a real link, same as Phase 2 did for "Point de vente"/"Ventes"/"Finances".

### Exit criteria

Matches `ROADMAP.md` Week 10 verbatim: PO CRUD through `draft → pending_approval → approved → ordered`, approval gated behind `purchases:approve`, line items compute TVA the same way sale/invoice line items do, and quotes from different suppliers are comparable for the same product set.

---

## Chunk B — Delivery & Receiving (roadmap Week 11)

**Goal:** receiving a delivery against an `ordered` PO creates real stock and batch records, partial deliveries are tracked correctly, and goods can be returned to a supplier.

### Schema

- `PurchaseDelivery` (`purchase_deliveries`) — per `DATABASE.md` §8.6 verbatim: `poId, deliveryNumber, deliveredAt, receivedBy, notes`.
  **Decision:** `deliveryNumber` is derived as `${po.poNumber}-R${n}` (n = count of prior deliveries against that PO, plus 1) rather than drawing from a new counter — ties the delivery's identity directly to its PO instead of adding a fifth `Store` counter field.
- `PurchaseDeliveryItem` (`purchase_delivery_items`) — per `DATABASE.md` §8.7 verbatim: `deliveryId, poItemId, productId, quantityDelivered, batchNumber, expirationDate, unitCost`.
- `ProductBatch` (`product_batches`) — per `DATABASE.md` §5.6 verbatim: `productId, batchNumber, manufacturingDate, expirationDate, quantityReceived, quantityRemaining, unitCost, supplierId, storeId, notes`, soft-delete, `CHECK (quantityRemaining >= 0)`. **This is where `StockMovement.batchId` and `SaleItem.batchId` finally get a real table to point at.**
- **Net-new (undocumented in `DATABASE.md`, named by ARCHITECTURE.md, required by Week 11's "Purchase returns")**: `PurchaseReturn` (`storeId, supplierId, originalDeliveryId, returnNumber, reason, totalRefunded, status, createdBy`) + `PurchaseReturnItem` (`returnId, deliveryItemId, productId, quantity, unitCost, reason`) — modeled directly on Phase 2's `SaleReturn`/`SaleReturnItem` shape (same over-return guard: validate against quantity delivered minus quantity already returned on that line). Uses `RETURN_OUT` (already reserved in `StockMovementType`, unused until now).

### Services & routes

- `src/server/services/purchase-deliveries.ts`:
  - `receiveDelivery(tx, { poId, items, receivedBy })` — for each line: calls the **existing** `recordStockMovement` (`src/server/services/stock.ts`) with `movementType: "PURCHASE_IN"`, `referenceType: "purchase_delivery"`; if the line has an `expirationDate`, creates a `ProductBatch` row first and passes its id as `StockMovement.batchId` (the same "only path that writes stock_movements" function Phase 1's adjustments and Phase 2's sales/returns all reuse — no new stock-writing primitive needed here either). Updates `PurchaseOrderItem.quantityReceived` and rolls the parent `PurchaseOrder.status` to `partially_received` (some lines short) or `received` (all lines complete).
- `src/server/services/purchase-returns.ts`: `createPurchaseReturn(tx, input)` — validates returned quantity against `PurchaseDeliveryItem.quantityDelivered` minus prior returns on that line (identical shape to Phase 2's `returns.ts`), records `RETURN_OUT`.
- New error classes: `InvalidReturnQuantityError`-equivalent for purchase returns (can likely reuse the exact class from `src/server/services/returns.ts` if its message is generic enough — check at implementation time rather than duplicating).
- Routes: `POST/GET /api/purchase-orders/[id]/deliveries`, `POST/GET /api/purchase-orders/[id]/returns`. Permission `purchases:create` for both (receiving and returning are purchasing-side actions, not separate inventory permissions — consistent with how Phase 1/2 scoped `pos:refund` as its own permission only because refunds needed a *tighter* gate than general POS operation; purchase returns don't need that distinction here since they already require the broader `purchases:create`).

### Frontend

- Delivery receiving screen (against a PO in `ordered` or `partially_received` status) — per-line inputs for quantity received, batch number, expiration date, defaulting quantity to whatever's still outstanding (`quantityOrdered - quantityReceived`).
- Purchase return dialog, reusable-pattern-wise identical to Phase 2's `ReturnDialog` (per-line remaining-returnable quantity, reason field).
- Batch/expiry data surfaces on the existing Inventory page's stock levels view as an added column or a small "batches" sub-view — decide the least disruptive way to expose it once Chunk B's schema is in place, without turning this into an Inventory-page redesign (out of scope for this chunk).

### Exit criteria

Matches `ROADMAP.md` Week 11 verbatim: partial and full deliveries recorded, `PURCHASE_IN` stock movements + `ProductBatch` rows created with expiration dates, PO status rolls forward (`partially_received`/`received`) correctly, purchase returns work with the same over-return guard Phase 2 established for sales.

---

## Chunk C — Warehousing (roadmap Week 12)

**Goal:** stock can move between stores through an approval/receiving workflow, physical inventory counts reconcile system vs. counted quantities into real adjustments, and storage locations are labeled for pick/put-away reference.

### Schema

- `StockTransfer` (`stock_transfers`) — per `DATABASE.md` §6.3 verbatim: `transferNumber, fromStoreId, toStoreId, status, notes, createdBy, approvedBy, receivedBy`, soft-delete. Enum `TransferStatus`: `draft, pending, in_transit, received, cancelled` (matches §14 exactly).
- `StockTransferItem` (`stock_transfer_items`) — per `DATABASE.md` §6.4 verbatim: `transferId, productId, quantityRequested, quantitySent (default 0), quantityReceived (default 0), notes`.
- `StockCount` (`stock_counts`) — per `DATABASE.md` §6.5 verbatim: `storeId, countNumber, status, startedAt, completedAt, notes, createdBy, approvedBy`. Enum `CountStatus`: `in_progress, pending_review, approved, cancelled`.
- `StockCountItem` (`stock_count_items`) — per `DATABASE.md` §6.6 verbatim: `countId, productId, systemQuantity, countedQuantity, difference` (Postgres `GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED` — same "hand-append what Prisma can't express" pattern already used for `StockLevel.quantityAvailable`), `adjustmentStatus`. Enum `AdjustmentStatus`: `pending, approved, rejected` (matches §14).
- **Decision — `Store.transferCounter` / `Store.countCounter`**: two more new `Int @default(0)` fields on `Store`, same counter pattern as `saleCounter`/`poCounter`. Formats `TRF-000001` / `CNT-000001`.
- **Decision — the actual "warehouse/zone/shelf/bin" part, deliberately scoped down.** `DATABASE.md` has zero schema for this anywhere in the file — it's a genuine gap, not a documented-but-unbuilt table like the four above. Building a real bin-level *inventory* system (where on-hand quantity is tracked per bin, not per store) would mean reworking `fn_apply_stock_movement` and every stock-writing caller from Phases 1-2 — disproportionate to "Week 12" scope, and nothing else in the app is ready to consume that granularity yet. Instead: a plain **labeling hierarchy** —
  - `Warehouse` (`storeId, name, address, isActive`) — a store can have more than one (e.g. a backroom and an offsite depot).
  - `WarehouseZone` (`warehouseId, name, code`).
  - `WarehouseBin` (`zoneId, code, notes`).
  - An optional nullable `binId` on `StockMovement` (same nullable-FK-for-future-detail pattern as the existing `batchId`) so a movement can record *where physically* a delivery was put away or a count line was found, without that location being load-bearing for on-hand-quantity math. `StockLevel`'s aggregation key stays exactly `(tenant_id, product_id, store_id)`, unchanged.
  This is flagged explicitly so a later phase can revisit with real bin-level accounting if it turns out to actually be needed — this chunk deliberately doesn't build toward that goal, it builds a labeled picking/put-away reference.

### Services & routes

- `src/server/services/stock-transfers.ts`: `createTransfer` (draft), `approveTransfer`, `sendTransfer` (records `quantitySent` per line, calls `recordStockMovement` with `TRANSFER_OUT` at `fromStoreId`, status → `in_transit`), `receiveTransfer` (records `quantityReceived` per line, `TRANSFER_IN` at `toStoreId`, status → `received`).
- `src/server/services/stock-counts.ts`: `createStockCount(tx, storeId, productIds)` — snapshots current `StockLevel.quantityOnHand` into each `StockCountItem.systemQuantity` at creation time (so the count reflects a fixed point, not a moving target while counting is in progress); `submitCount` (`in_progress` → `pending_review`); `approveCount` — for each item where `difference !== 0`, calls `recordStockMovement` with `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` depending on the sign (same shape `adjustStock` already uses, `notes` stamped with the count number for traceability), marks that item's `adjustmentStatus` `approved`.
- `src/server/services/warehouses.ts`: plain CRUD for `Warehouse`/`WarehouseZone`/`WarehouseBin` — no business logic beyond `assertBelongsToTenant`-style reference checks, same shape as Phase 1's `categories.ts`/`brands.ts`/`units.ts`.
- Routes: `POST/GET /api/stock-transfers` (+ `[id]/approve`, `/send`, `/receive`), `POST/GET /api/stock-counts` (+ `[id]/submit`, `/approve`), `POST/GET /api/warehouses` (+ nested zones/bins, or flat routes scoped by query param — match whichever the products module's categories/brands/units precedent actually used).
- **Permissions**: reuses the already-seeded `inventory:transfer`/`inventory:count`. **Decision:** grant `INVENTORY_CLERK` `purchases:read` too — it currently has both inventory-side permissions this chunk needs but not the ability to view the POs it would be receiving deliveries against (a Chunk B concern, but the role-grant change belongs in whichever chunk's seed touch lands first; noted here since this is where the gap was found).

### Frontend

- Warehouses/Zones/Bins management — tabs on a `/warehouses` page, same tab-management pattern as Phase 1's Categories/Brands/Units tabs on the Products page.
- Stock Transfers: list + create (pick from-store/to-store + items) + approve + send + receive flow, same list/dialog pattern as everywhere else.
- Stock Counts: list + create (pick store + products to count, or "count everything") + a counting entry screen (enter counted quantity per line) + approve (shows the diff, confirms adjustment creation).
- i18n namespaces `warehouses.*`, `stockTransfers.*`, `stockCounts.*`.

### Exit criteria

Matches `ROADMAP.md` Week 12 verbatim: transfers move stock between stores through an approval/receiving workflow, counts capture system-vs-counted and approval produces real `ADJUSTMENT_IN`/`ADJUSTMENT_OUT` movements (verifiable the same way Chunk A of Phase 2 verified `SALE_OUT` — check `stock_movements` directly), warehouse locations exist and are browsable.

---

## Chunk D — Procurement Polish (roadmap Week 13)

**Goal:** read-only views that turn Chunks A-C's data into decision support — reorder suggestions, a real supplier catalog browser, and basic purchasing/delivery analytics.

### No new schema — pure aggregation over Chunks A-C

- **Reorder suggestions.** **Decision:** threshold on `Product.minStockLevel`, not `reorderPoint`/`safetyStock` — both of the latter are AI-computed columns that stay `null` until Phase 5's optimization engine exists (confirmed by existing schema comments: *"reorderPoint/safetyStock stay null in Phase 1 — computed by the AI/optimization engine, which doesn't exist until Phase 5"*). Query: products where `StockLevel.quantityOnHand <= Product.minStockLevel`, grouped by preferred supplier (`SupplierProduct.isPreferred`), suggested order quantity defaulting to that supplier's `minOrderQuantity`. This is genuinely "basic" per the roadmap's own wording, not a forecast.
- **Supplier product catalog view.** A browsable, filterable (by supplier or by product) list across *all* `SupplierProduct` rows. Distinct from Phase 1's existing `LinkedProductsDialog` (which only ever shows one supplier's products at a time, opened from that supplier's row) — this is the reverse/global view the roadmap calls for.
- **Purchase analytics.** Spend by supplier and by category, aggregated from `PurchaseOrder`/`PurchaseOrderItem` joined through `Product.categoryId`.
- **Delivery performance.** On-time delivery rate per supplier: `PurchaseDelivery.deliveredAt` vs. the parent `PurchaseOrder.expectedDeliveryDate`.

### Frontend

- A Purchasing reports/dashboard page bundling all four views above (reorder suggestions, spend analytics, delivery performance) plus the supplier catalog page as a separate route. Reuse existing chart/stat-tile conventions if any were established elsewhere in the app by this point — otherwise plain tables are sufficient for a first pass, consistent with "ship the smallest thing" over building a dashboard framework this chunk doesn't need.

### Exit criteria

Matches `ROADMAP.md` Week 13 verbatim: all four views render correct numbers against real data generated by Chunks A-C (verify by generating a handful of POs/deliveries/quotes first, then checking the aggregates by hand against the DB).

---

## Sequencing notes

Do the chunks in order:
- **B depends on A** — receiving requires a `PurchaseOrder`/`PurchaseOrderItem` to receive against.
- **C is schema-independent of A/B** but should still come after them in practice — warehousing is the lower-priority, more speculative half of the phase (see the scoped-down warehouse-hierarchy decision above), fine to defer or even skip a session if time runs short, whereas A/B complete the actual "products come in" half of the roadmap's stated Phase 3 goal.
- **D depends on real data from A-C** — reorder suggestions, spend analytics, and delivery-performance numbers are meaningless against an empty database; don't start D until at least a few POs/deliveries exist to verify against.

Close out each chunk with a new dated entry in `Dev Log.md` — same format as every phase so far.
