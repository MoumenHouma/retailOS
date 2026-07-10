# Phase 4 Implementation Plan — Finance & Customers

> Companion to [[ROADMAP]] (weeks 14-17, source of truth for exit criteria), [[ARCHITECTURE]] §4.7-4.9 (module specs) and [[DATABASE]] §9-11+§14 (schema). See [[Dev Log]] for how Phases 0-3 actually went, and [[PHASE3_PURCHASING_PLAN]] for the sibling doc this one is modeled on.

## How to use this doc

Phase 4 (roadmap weeks 14-17) is broken into **four chunks** below, each sized to be one dev session — same granularity as [[PHASE2_POS_PLAN]] and [[PHASE3_PURCHASING_PLAN]]. Each chunk lists the schema, services/routes, and UI to build, reusing the exact conventions already established across Phases 0-3 (named explicitly below). **Do the chunks in order** — see Sequencing notes at the end. Close out each chunk with a new dated entry in `Dev Log.md`, same pattern as every phase so far.

Several decisions this doc needs to make on its own — because the source docs disagree with each other, are silent, or simply don't specify a schema the roadmap still requires — are called out inline as **`Decision:`**. Read them; they're there so a later session doesn't have to re-derive the same call.

### A note on doc trust, going in

Same situation Phase 3 hit with `stock_transfers`/`stock_counts`: `DATABASE.md` §9 (`expenses`, `expense_categories`), §10 (`customers` extra columns, `loyalty_point_transactions`, `customer_debts`), and §11 (`employees`) are fully specified but **none of it exists in the live schema yet** — confirmed by grepping `prisma/schema.prisma`: the live `Customer` model has only `id/tenantId/name/phone/customerType/isActive` plus timestamps/soft-delete, and its own code comment says outright *"Loyalty/debt/segmentation columns (DATABASE.md §10) are deferred to whichever later phase actually needs them."* Treat `DATABASE.md` §9-11 as ready-to-implement schema, not evidence anything already exists.

**A new wrinkle Phase 3 didn't have:** `ARCHITECTURE.md` §4.7-4.9 names several tables `DATABASE.md` never specifies columns for at all — `invoice_payments`, `financial_periods`, `journal_entries`, `tax_rates`, `payment_methods`, `customer_segments`, `customer_debt_payments`, `work_schedules`, `attendance_records`, `commissions`, `commission_rules`. Each is resolved below with an explicit `Decision:` (build net-new with a designed schema, or skip in favor of an enum/existing table/pure aggregation). A consolidated divergence table is at the end for quick reference.

**One genuinely good find:** Week 17's "Role and permission management (RBAC)" needs **zero new schema**. `Role`, `Permission` (global catalog), `RolePermission` (junction), and `UserRole` (supports per-store role scoping) are already fully tenant-dynamic since Phase 0 — a tenant's `BUSINESS_OWNER` can, schema-wise, already create a custom `Role`, attach any subset of the global `Permission` catalog to it, and assign it to users. `prisma/seed.ts`'s `PERMISSION_CATALOG`/`ROLE_PERMISSIONS` are just seeded starting data, not a ceiling. Week 17's RBAC scope is an **admin UI** over this existing model, not a new custom-role engine — see Chunk D.

---

## Chunk A — Financial Management (roadmap Week 14)

**Goal:** every expense a store incurs is tracked and categorized, a manager can see revenue at a glance, a simplified P&L and TVA collected-vs-paid summary render against real data, and unpaid invoices can be tracked and paid down over time.

### Schema

- `Expense` (`expenses`) — per `DATABASE.md` §9.3 verbatim: `storeId` (FK `Store`, nullable), `categoryId` (FK `ExpenseCategory`), `description`, `amount` (Int centimes), `tvaRate` (default 0), `expenseDate` (DATE), `paymentMethod` (reuse the existing `PaymentMethodType` enum — `CASH/CARD/CHECK/TRANSFER/MIXED` — already defined for `SalePayment`, no new enum needed despite `DATABASE.md` naming it `payment_method_enum` — concrete-schema-wins precedent, same as Phase 3's `po_status_enum` resolution), `reference`, `supplierId` (FK `Supplier`, nullable — lets an expense tie back to a supplier bill that isn't a `PurchaseOrder`, e.g. a utility bill or cash-and-carry receipt), `receiptUrl`, `notes`, `createdBy`, timestamps, soft-delete.
  **Decision:** no `Store.expenseCounter` — `reference` is free text the user types in (an external receipt/invoice number), not a system-generated sequential number. No Phase 4 entity needs the counter pattern (confirmed at the end of this doc).
- `ExpenseCategory` (`expense_categories`) — per `DATABASE.md` §9.4 verbatim: `name`, `parentId` (self-ref, hierarchical), `description`, `isActive`. Same hierarchy shape as `ProductCategory` — reuse the exact cycle-guard pattern from `src/server/services/categories.ts`.
  **Decision:** `DATABASE.md` doesn't list a `deletedAt` for this table (only `isActive`), unlike `ProductCategory` which has both. Follow the spec exactly (isActive-only) — a deliberate, spec-driven deviation, not an oversight.
- **Net-new — `InvoicePayment`** (not in `DATABASE.md` at all; `ARCHITECTURE.md` §4.7 names `invoice_payments` with zero columns specified). This is the natural home for Week 14's "Payment tracking (accounts receivable)" — the live `Invoice` model already has `partially_paid`/`overdue` in its `InvoiceStatus` enum with nothing that ever writes them. Design: `id, tenantId, invoiceId (FK Invoice), amount (Int), paymentMethod (PaymentMethodType), reference (nullable), paidAt (DateTime), recordedBy (FK User), createdAt` — immutable ledger, exactly the `StockMovement`/loyalty-ledger shape used elsewhere.
  **Decision — denormalized running balance:** add `Invoice.amountPaid Int @default(0)` (new column on the existing model), updated transactionally by `recordInvoicePayment` — same "ledger row + denormalized balance on the parent" relationship as `StockMovement → StockLevel`.
  **Decision — overdue status:** don't write `overdue` via a background job (no cron/queue infra exists yet — that's Phase 5/6). Compute it at read time: an invoice displays as "overdue" whenever `status` is `issued`/`partially_paid` and `dueDate < now()`, without mutating the stored enum. `paid`/`partially_paid` transitions ARE written synchronously by `recordInvoicePayment` (comparing `amountPaid` to `netToPay`).

### Services & routes

- `src/server/services/expenses.ts`: `createExpense`, `updateExpense`, `softDeleteExpense`, `searchExpenses(tx, query)` (filter by `storeId`/`categoryId`/date range/`paymentMethod`).
- `src/server/services/expense-categories.ts`: CRUD, `InvalidParentError`/cycle-guard cloned from `categories.ts`.
- `src/server/services/invoice-payments.ts`: `recordInvoicePayment(tx, invoiceId, input)` — validates `amount <= netToPay - amountPaid`, inserts `InvoicePayment`, increments `Invoice.amountPaid`, recomputes `Invoice.status`. New error `InvoiceOverpaymentError` (422), registered in `src/lib/service-errors.ts` same as every prior chunk's new errors.
- `src/server/services/financial-reports.ts`: `getRevenueDashboard(tx, {storeId?, from, to, granularity})` (daily/weekly/monthly buckets over `Sale`), `getProfitAndLoss(tx, {from, to, storeId?})`, `getTvaSummary(tx, {from, to})`.
  **Decision — P&L formula:** Revenue = `sum(Sale.subtotal)` for `completed` sales in range; COGS = `sum(SaleItem.quantity * SaleItem.costPrice)`; Gross margin = Revenue − COGS; Operating expenses = `sum(Expense.amount)` in range; Net = Gross margin − Operating expenses. "Simplified" per the roadmap's own wording — no accruals, no depreciation, no COGS-vs-inventory-valuation reconciliation.
  **Decision — TVA collected vs. paid:** *Collected* = `sum(Sale.tvaAmount)` for completed sales in range — use `Sale`, not `Invoice`, since an `Invoice` is a compliance document generated *from* a `Sale`, not an independent revenue event; summing both would double-count TVA on invoiced sales. *Paid* = `sum(PurchaseOrderItem.tvaAmount)` for POs whose parent status is `received`/`partially_received` with `orderedAt` in range, plus the TVA portion of `Expense` rows (`Expense.amount` treated as TTC/gross — `expenseTva = amount − amount / (1 + tvaRate/100)`, decomposed rather than added on top). Flagged explicitly as a simplification: a real TVA declaration keys off supplier-invoice-received dates, not PO status — acceptable given the roadmap's own "simplified"/"summary" wording and the total absence of a `SupplierInvoice` entity anywhere in the schema.
- Routes (all on the `auth() → requirePermission → Zod safeParse → withTenant → apiSuccess/mapServiceError` skeleton from `src/app/api/purchase-orders/route.ts`):
  - `POST/GET /api/expenses`, `GET/PATCH/DELETE /api/expenses/[id]`.
  - `POST/GET /api/expense-categories`, `PATCH/DELETE /api/expense-categories/[id]`.
  - `POST /api/invoices/[id]/payments`, `GET /api/invoices/[id]/payments`.
  - `GET /api/finance/revenue-dashboard`, `GET /api/finance/profit-loss`, `GET /api/finance/tva-summary`.
- **Permissions:** current `PERMISSION_CATALOG.finance = ["finance:read", "finance:invoice", "finance:report"]` has no expense- or AR-specific string. **Decision:** add `finance:expense` (expense/category CRUD) and `finance:payment` (record invoice payments) to `PERMISSION_CATALOG.finance` in `prisma/seed.ts`. `ACCOUNTANT`'s grant already does `[...PERMISSION_CATALOG.finance, ...]` (a spread, not an enumerated list), and `BUSINESS_OWNER`/`STORE_MANAGER` derive from `ALL_PERMISSIONS` — both new strings are picked up automatically, no per-role edit needed.

### Frontend

- `src/app/[locale]/(dashboard)/expenses/page.tsx` + `src/components/finance/expenses-view.tsx` — list/filter/create/edit/soft-delete, same TanStack Query `{data, meta}` pattern as `suppliers-view.tsx`. Expense Categories as a management tab on the same page, same tab-management shape as Products' Categories/Brands/Units tabs.
- `src/app/[locale]/(dashboard)/finance/page.tsx` + `src/components/finance/financial-dashboard-view.tsx` — Revenue/P&L/TVA as tabs, reusing `StatTile`/`PageHeader`.
  **Decision:** this is the *operational* finance page (day-to-day: expenses + the Week 14 dashboard). Week 16's deeper analysis views get their own `groups.reports` entry in Chunk C rather than piling more tabs onto this page — keeps "operate finance" and "analyze finance" visually separate, mirroring how Phase 3 split `purchase-orders` (operate) from `procurement-reports` (analyze).
- AR payment UI lives on the existing Invoice detail view: a "Record Payment" dialog + a payment-history table, extending whatever the current invoice detail component is.
- Nav: new `groups.finance` group in `src/config/nav.ts` (`Expenses`, `Financial Dashboard`).
- i18n namespaces `expenses.*`, `expenseCategories.*`, `financialDashboard.*`, and an `invoices.payments.*` sub-namespace, added to all three of `src/i18n/{fr,en,ar}.json`.

### Exit criteria

Matches `ROADMAP.md` Week 14 verbatim: expense tracking and categorization; revenue dashboard (daily, weekly, monthly); simplified P&L; TVA collected vs. TVA paid summary; payment tracking (accounts receivable).

---

## Chunk B — Customer Management (roadmap Week 15)

**Goal:** full customer records with purchase history, an earn/redeem loyalty ledger, credit-purchase debt tracking, segmentation, and per-customer price overrides that actually affect what a customer pays at the register.

### Schema

- Extend `Customer` with the `DATABASE.md` §10.1 columns not yet present: `email, address, city, nif, creditLimit (default 0), currentDebt (default 0), loyaltyPoints (default 0), totalPurchases (default 0), totalSpent (default 0), visitCount (default 0), lastVisitAt`. `customerType` enum (`walk_in/regular/vip/wholesale`) already exists — no change needed there.
  **Decision — segmentation:** `ARCHITECTURE.md` §4.8 names a separate configurable `customer_segments` table; `DATABASE.md`'s concrete `customer_type_enum` column already covers exactly the four values the roadmap asks for. Enum wins — same precedent as Phase 3's `po_status_enum` resolution. No new table.
- `LoyaltyPointTransaction` (`loyalty_point_transactions`) — per §10.2 verbatim: `customerId, points (signed Int), balanceAfter, reason, referenceId (nullable, linked sale), createdAt`.
  **Decision:** `reason` stays a plain `String` (matches `DATABASE.md`'s `VARCHAR(100)`, not a DB enum) — validated at the Zod layer as `z.enum(["purchase","redemption","expiry","adjustment"])`, not promoted to a Prisma enum, since `DATABASE.md` §14's enum table never lists it as one.
  **Decision — naming conflict:** `ARCHITECTURE.md` calls this `customer_loyalty_points`; `DATABASE.md`'s concrete table is `loyalty_point_transactions`. Concrete schema wins, use `DATABASE.md`'s name.
- `CustomerDebt` (`customer_debts`) — per §10.3 verbatim: `customerId, amount, remaining, saleId (nullable), dueDate, status, notes, createdAt`. New enum `DebtStatus` (`debt_status_enum`: `outstanding/partially_paid/paid/written_off`, per §14).
- **Net-new — `CustomerDebtPayment`** (undocumented in `DATABASE.md`; `ARCHITECTURE.md` names `customer_debt_payments` with no columns). Design: `id, tenantId, debtId (FK CustomerDebt), amount, paymentMethod (PaymentMethodType), reference (nullable), paidAt, recordedBy (FK User), createdAt` — immutable ledger, same shape as `InvoicePayment`. On insert: decrements `CustomerDebt.remaining`, flips `status` (`partially_paid`/`paid`), recomputes the denormalized `Customer.currentDebt = sum(remaining)` across that customer's open (non-`written_off`) debts.
  **Decision — why separate from `InvoicePayment` rather than one shared "Payment" table:** an `Invoice` is a formal DÉCRET-05-468 document; a `CustomerDebt` models the much more common small-retail "customer tab" — a credit sale with no invoice ever generated. The roadmap deliberately splits these across two different weeks (14 vs. 15) with different exit-criteria wording ("payment tracking (AR)" vs. "customer debt tracking (credit purchases)"), so keeping two ledgers matching two real-world flows is truer to the domain than forcing a shared abstraction this early.
- **Net-new — `CustomerPrice`** (customer-specific pricing; not named anywhere in either source doc — a genuine schema gap like Phase 3's `SupplierQuote`). Design: `id, tenantId, customerId (FK), productId (FK), price (Int), isActive, createdAt, updatedAt`, `@@unique([tenantId, customerId, productId])` — a flat per-customer-per-product override, same shape as the existing `SupplierProduct` per-relationship pricing row.
  **Decision — scope:** no tiered quantity breaks, no date-ranged promotional pricing — a single override price per customer/product pair. Matches "ship the smallest thing" and the roadmap's own terse single-bullet wording.
  **Decision — wiring into POS (the important one):** a `CustomerPrice` table with no consumer is an inert data-entry screen — "customer-specific pricing" only means something if it changes what a customer actually pays. This chunk makes a **small, additive touch to the already-shipped `src/server/services/sales.ts`**: in the line-item pricing step (`priceItems`), when `input.customerId` is present, look up `CustomerPrice` for that customer+product before falling back to `Product.sellingPrice`. Confirmed live: `priceItems(tx, items)` currently takes no `customerId` param — this chunk threads it through. Mirrors how Phase 3 Chunk B reused (not redesigned) `recordStockMovement` — extend the existing pricing function with one additional lookup branch, don't rewrite it.
- **Loyalty earn/redeem business rule.** **Decision:** hardcode the ratios `ARCHITECTURE.md` §4.8 gives as examples — 1 point per 100 DZD spent (`Sale.total`), 100 points = 50 DA redemption value — as code constants for this phase, not a per-tenant-configurable setting. `Tenant.settings` (already a `Json` column) is the natural home if a later phase needs per-tenant configurability; no migration needed to add that later.
  **Decision — second POS touch:** after a completed sale with `customerId` present, call `earnPoints` (append `LoyaltyPointTransaction`, bump `Customer.loyaltyPoints`) — the second, equally small, additive touch to `sales.ts` this chunk needs. Both touches are called out together since they're the only place Phase 4 reaches back into already-shipped, performance-sensitive (sub-500ms) Phase 2 code.

### Services & routes

- `src/server/services/customers.ts` — extend with `updateCustomer`, `softDeleteCustomer` (gap: currently only `createCustomer`/`searchCustomers` exist), `getPurchaseHistory(tx, customerId)` (joins `Sale` where `customerId` matches).
- `src/server/services/loyalty.ts`: `earnPoints(tx, {customerId, saleId, points})`, `redeemPoints(tx, {customerId, points, reason})` — guards against redeeming more than balance, new error `InsufficientLoyaltyPointsError`.
- `src/server/services/customer-debts.ts`: `createDebt(tx, {customerId, amount, saleId?, dueDate?, notes})`, `recordDebtPayment(tx, debtId, input)` — new error `DebtOverpaymentError`; optional soft check against `Customer.creditLimit` when creating a new debt.
- `src/server/services/customer-pricing.ts`: `setCustomerPrice`, `removeCustomerPrice`, `listCustomerPrices`, `getEffectivePrice(tx, customerId, productId)` (the function `sales.ts` calls into).
- Routes: `PATCH/DELETE /api/customers/[id]`, `GET /api/customers/[id]/purchase-history`, `POST /api/customers/[id]/loyalty/redeem`, `GET /api/customers/[id]/loyalty`, `POST/GET /api/customers/[id]/debts`, `POST /api/customer-debts/[id]/payments`, `POST/GET/DELETE /api/customers/[id]/prices`.
- **Permissions:** current `PERMISSION_CATALOG.customers = ["customers:read", "customers:create"]` — no update/delete at all. **Decision:** add `customers:update` and `customers:delete` (mirrors the four-verb shape already used by `products`), and fold loyalty/debt/pricing management under `customers:update` rather than minting five more granular strings — avoids over-fragmenting permissions for a first pass. `CASHIER` keeps only `customers:read`/`customers:create` (shouldn't edit customer master data or debts from the register). **Decision — gap fix:** `ACCOUNTANT` currently has no `customers:*` permission at all despite needing debt/AR visibility for financial reporting — add `customers:read` to its grant, same "found and fixed a role gap" pattern Phase 3 used for `INVENTORY_CLERK` + `purchases:read`.

### Frontend

No `/customers` dashboard page exists yet at all (confirmed — only `src/app/api/customers/route.ts` + the service/validator exist today) — this chunk builds it from scratch, not an extension.

- `src/app/[locale]/(dashboard)/customers/page.tsx` + `src/components/customers/customers-view.tsx` — list/search/create/edit/soft-delete, same list pattern as `suppliers-view.tsx`.
- `src/components/customers/customer-detail-view.tsx` — tabs: Profile, Purchase History, Loyalty (balance + ledger + redeem dialog), Debts (list + record-payment dialog), Custom Pricing (per-product override table).
- Nav: **Decision** — append `Customers` to the existing `groups.sales` (customers are a sales-adjacent concept already reached from POS's customer picker), avoiding a one-item nav group.
- i18n namespaces `customers.*` (extend existing), `customerDebts.*`, `loyalty.*`, `customerPricing.*`.

### Exit criteria

Matches `ROADMAP.md` Week 15 verbatim: customer CRUD; purchase history (from sales); loyalty points (earn on purchase, redeem for discount); customer debt tracking (credit purchases); customer segmentation (walk-in/regular/VIP/wholesale); customer-specific pricing.

---

## Chunk C — Advanced Financial Reports (roadmap Week 16)

**Goal:** read-only reporting views that turn Chunks A-B's data into balance sheet, cash flow, tax-report, expense-analysis, and margin-analysis outputs, plus a lightweight way to bound reports to declared fiscal periods.

### Schema

**Decision — one new table, everything else is pure aggregation** (matches Phase 3 Chunk D's "no new schema, pure aggregation over prior chunks" precedent):

- **Net-new — `FinancialPeriod`** (`ARCHITECTURE.md` names `financial_periods`, zero columns specified; `DATABASE.md` doesn't mention it at all). Design: `id, tenantId, name (e.g. "Juillet 2026"), startDate, endDate, status (open/closed — new lightweight enum), closedAt (nullable), closedBy (nullable FK User), createdAt, updatedAt`, `@@unique([tenantId, name])`.
  **Decision — scope:** closing a period is **advisory only** — it does not block new `Expense`/`Sale`/`Invoice` rows dated inside a closed period. Full ledger-locking enforcement is a materially bigger feature (would need write-path checks threaded through several already-shipped services) than "simplified... financial period management" implies; flagged explicitly as a candidate to tighten later if real accounting rigor is required.
- **Decision — skip `journal_entries`/`tax_rates`/`payment_methods`** (all three named in `ARCHITECTURE.md` §4.7, none specced in `DATABASE.md`, no roadmap task literally requires them). A real double-entry journal/chart-of-accounts is a different order of complexity than a retail-SMB "simplified balance sheet/cash flow," and TVA rates are already effectively configurable at the row level via `Product.tvaRate`/`Expense.tvaRate` (SmallInt), not a dedicated rates table. Compute every report below as a read-model directly over `Sale`, `SaleItem`, `Invoice`, `InvoicePayment`, `Expense`, `PurchaseOrder`, `PurchaseDelivery`, and `CustomerDebt`.

Report formulas (all query-time, no persistence):

- **Balance sheet (simplified).** Assets ≈ cash-in-hand proxy (`sum(Sale.totalPaid) + sum(InvoicePayment.amount) + sum(CustomerDebtPayment.amount) − sum(Expense.amount)`, all-time) + Accounts Receivable (`sum(Invoice.netToPay − amountPaid)` for open invoices + `sum(CustomerDebt.remaining)` for open debts) + Inventory value (`sum(StockLevel.quantityOnHand * Product.costPrice)`). Liabilities ≈ Accounts Payable, approximated as the **full total** of every non-cancelled `PurchaseOrder` (`ordered`/`partially_received`/`received`) — **Decision, flagged explicitly as a known limitation:** Phase 4's roadmap scope only asks for *accounts receivable* tracking (Week 14), never accounts-payable/supplier-payment tracking, so there is no ledger telling us how much of a PO has actually been paid to the supplier. Treating the whole PO total as unpaid overstates liabilities but is the only defensible number available without inventing an out-of-scope AP-payment table. Equity is a plug (`Assets − Liabilities`), not independently tracked — standard for a report with no share-capital/retained-earnings ledger.
- **Cash flow statement (simplified).** Cash in = `sum(Sale.totalPaid) + sum(InvoicePayment.amount) + sum(CustomerDebtPayment.amount)` for the period. Cash out = `sum(Expense.amount)` for the period. **Decision:** exclude PO-driven outflow from the "cash" figure (same AP-ledger gap as above) — surface it as a clearly-labeled separate line, "Purchases (accrual, not cash-confirmed)," rather than silently mixing accrual and cash bases.
- **Tax report (TVA declaration support).** Reuses Chunk A's `getTvaSummary`, bucketed by month/quarter to match Algerian G50 declaration cadence. **Decision:** CSV export is the MVP deliverable (satisfies the phase-level exit criterion "Accountants can export financial data" verbatim); a compliant G50-format PDF is a stretch goal, explicitly out of this chunk's required scope.
- **Expense analysis by category.** Group `Expense` by `categoryId`, rolling child-category totals up into parents — same recursive-tree-aggregation shape category hierarchies already require, no new pattern.
- **Margin analysis by product/category/brand.** `sum(SaleItem.quantity * (SaleItem.unitPrice − SaleItem.costPrice))` grouped by `productId`/`Product.categoryId`/`Product.brandId` over a date range — the same "join `SaleItem`/`PurchaseOrderItem` through `Product`" shape Phase 3 Chunk D already used for spend-by-category.

### Services & routes

- `src/server/services/financial-periods.ts`: `createPeriod`, `closePeriod`, `listPeriods`.
- `src/server/services/financial-reports-advanced.ts` (new file, keeps Chunk A's `financial-reports.ts` from growing unbounded): `getBalanceSheet`, `getCashFlowStatement`, `getTaxReport`, `getExpenseAnalysis`, `getMarginAnalysis`.
- Routes: `POST/GET /api/financial-periods` (+ `[id]/close`); `GET /api/finance/balance-sheet`, `/cash-flow`, `/tax-report` (+ `?format=csv`), `/expense-analysis`, `/margin-analysis`.
- **Permissions:** all report reads gated by the already-seeded `finance:report`; CSV/export buttons gated by the already-seeded `reports:export` — no new read-permission strings needed. **Decision:** add one new string, `finance:period` (create/close `FinancialPeriod`), since that's a write action distinct from read-only reporting. `BUSINESS_OWNER`/`STORE_MANAGER` pick it up automatically via `ALL_PERMISSIONS`; `ACCOUNTANT` picks it up automatically via its `[...PERMISSION_CATALOG.finance]` spread.

### Frontend

- `src/app/[locale]/(dashboard)/financial-reports/page.tsx` (new page, distinct from Chunk A's `/finance` operational dashboard) with tabs: Balance Sheet, Cash Flow, Tax Report, Expense Analysis, Margin Analysis.
- `src/app/[locale]/(dashboard)/financial-periods/page.tsx` — simple list + create + close, settings-shaped.
- Nav: **Decision** — put `financial-reports` into `groups.reports` (alongside `procurement-reports`, both report-shaped, both read-only analysis) rather than `groups.finance` (which stays the operational expenses/dashboard group from Chunk A); `financial-periods` goes into `groups.finance` since it's a day-to-day settings action.
- i18n: `financialPeriods.*`, `financialReports.*` (with `balanceSheet`/`cashFlow`/`taxReport`/`expenseAnalysis`/`marginAnalysis` sub-keys).

### Exit criteria

Matches `ROADMAP.md` Week 16 verbatim: balance sheet (simplified); cash flow statement; tax report (TVA declaration support); expense analysis by category; margin analysis by product, category, brand; financial period management.

---

## Chunk D — Employee Management (roadmap Week 17)

**Goal:** employee records, an RBAC admin UI over the already-existing dynamic Role/Permission model, basic work-schedule and attendance tracking, sales-commission calculation, and an employee performance dashboard.

### Schema

- `Employee` (`employees`) — per `DATABASE.md` §11.1 verbatim: `userId` (FK `User`), `firstName, lastName, dateOfBirth, phone, email, address, position, department, hireDate, salary (Int centimes), contractType, isActive`, timestamps, soft-delete. New enum `ContractType` (`contract_type_enum`: `cdi/cdd/interim/freelance`, per §14).
  **Decision:** `userId` is **nullable** — a worker without a system login (e.g. warehouse staff) should still be recordable as an employee; `DATABASE.md` doesn't state `NOT NULL` for this FK either.
- **Net-new — `WorkShift`** (`ARCHITECTURE.md` names `work_schedules`, no columns specified). Design: `id, tenantId, employeeId (FK Employee), storeId (FK Store), startsAt (DateTime), endsAt (DateTime), status (scheduled/completed/cancelled), notes, createdBy`.
  **Decision:** two full `DateTime` (timestamptz) columns rather than a separate date + `TIME`-of-day pair — matches how `PosSession.openedAt`/`closedAt` already represents a span. Concrete dated shifts, not a recurring weekly template — a template/recurrence engine is disproportionate to "basic... work schedule management," flagged as a follow-up if real rostering is needed later.
- **Net-new — `AttendanceRecord`** (`ARCHITECTURE.md` names `attendance_records`, no columns specified). Design: `id, tenantId, employeeId (FK), storeId (FK), workDate (Date), clockIn (nullable DateTime), clockOut (nullable DateTime), shiftId (nullable FK WorkShift), status (present/late/absent/on_leave — new lightweight enum), notes, createdBy`.
  **Decision:** basic clock-in/out only — no biometric/geofence/break-tracking, matching the roadmap's own "(basic)" qualifier verbatim.
- **Net-new — `CommissionRule`** (`ARCHITECTURE.md` names `commission_rules`, no columns specified). Design: `id, tenantId, name, scope (enum: global/employee), targetEmployeeId (nullable FK Employee, set when scope=employee), rateType (percentage/fixed), rateValue (Int), isActive, createdAt, updatedAt`.
  **Decision — scope reduction:** `ARCHITECTURE.md` mentions "commission configuration per role/product/category," but this chunk deliberately builds only `global` and `employee` scopes. Product/category-scoped commission requires resolving commission at the `SaleItem` level instead of the `Sale` level — a real complexity jump nothing else in the roadmap asks for — flagged as a follow-up, not built now.
- **Net-new — `SaleCommission`** (`ARCHITECTURE.md` names `commissions`, no columns specified). Design: `id, tenantId, employeeId (FK), saleId (FK Sale), ruleId (FK CommissionRule), baseAmount (Int), amount (Int), calculatedAt, createdAt`, `@@unique([tenantId, saleId, ruleId])` (makes recomputation idempotent).
  **Decision — base amount:** commission is computed against `Sale.subtotal` (excl. TVA/tax-stamp), not `Sale.total` — commission on revenue, not on tax collected on the business's behalf.
  **Decision — the most important call in this chunk: commission calculation is NOT hooked synchronously into Phase 2's `completeSale`.** Unlike Chunk B's two POS touches (judged worth the small coupling), wiring commission resolution into the hot, roadmap-explicitly-"sub-500ms" sale-completion path — while commission rules can themselves change after the fact — is a needless risk to already-shipped, performance-sensitive code. Instead, `calculateCommissionsForPeriod(tx, {from, to})` is a batch/on-demand service function (triggered by an admin action button in this phase; wiring it to a scheduled job is Phase 5/6 infra, out of scope here) that scans completed `Sale`s in a window, resolves `Employee` via `Sale.cashierId = Employee.userId`, applies active `CommissionRule`s, and upserts `SaleCommission` rows keyed by `(saleId, ruleId)`.
- **RBAC — no new schema.** Confirmed above: `Role`/`Permission`/`RolePermission`/`UserRole` are already tenant-dynamic since Phase 0. Week 17 builds only the admin UI + routes over the existing model.

Employee performance dashboard: pure aggregation, no new table — per-employee sales total (`Sale` via `cashierId → Employee.userId`), commission total (`SaleCommission`), attendance rate (`AttendanceRecord` vs. `WorkShift`).

### Services & routes

- `src/server/services/employees.ts`: `createEmployee`, `updateEmployee`, `softDeleteEmployee`, `searchEmployees`.
- `src/server/services/work-shifts.ts`: `createShift`, `updateShift`, `cancelShift`, `listShifts(dateRange, storeId?/employeeId?)`.
- `src/server/services/attendance.ts`: `clockIn(tx, {employeeId, storeId})`, `clockOut(tx, {recordId})`, `listAttendance(query)`. New error `AlreadyClockedInError`.
- `src/server/services/commission-rules.ts`: CRUD.
- `src/server/services/commissions.ts`: `calculateCommissionsForPeriod`, `listCommissionsForEmployee`.
- `src/server/services/roles.ts` (net-new despite no schema change): `createRole`, `updateRolePermissions`, `assignUserRole`, `revokeUserRole`, `listRoles(withPermissions)`, `listPermissionCatalog` (groups the global `Permission` table by `module`).
- `src/server/services/employee-performance.ts`: `getEmployeePerformance(tx, {from, to, storeId?})`.
- Routes: `POST/GET /api/employees` (+ `[id]` GET/PATCH/DELETE); `POST/GET /api/work-shifts` (+ `[id]`); `POST /api/attendance/clock-in`, `/clock-out`, `GET /api/attendance`; `POST/GET /api/commission-rules` (+ `[id]`); `POST /api/commissions/calculate`, `GET /api/commissions`; `POST/GET /api/roles` (+ `[id]`, `[id]/permissions`, `[id]/assign`); `GET /api/permissions` (catalog); `GET /api/employee-performance`.
- **Permissions:** keep the existing `employees:read`/`employees:manage` as the base gate for Employee CRUD (no seed change needed there). **Decision — three new strings**, split by sensitivity: `employees:schedule` (shifts + attendance — appropriate for `STORE_MANAGER`'s day-to-day staffing), `employees:payroll` (salary visibility/edits + commission-rule configuration — `BUSINESS_OWNER`-only), `employees:roles` (RBAC admin UI — `BUSINESS_OWNER`-only; letting a `STORE_MANAGER` grant itself `employees:manage` via the roles UI would be a privilege-escalation hole). **Decision — seed change:** `STORE_MANAGER`'s existing filter (`ALL_PERMISSIONS.filter(p => p !== "employees:manage")`) must be widened to also exclude `employees:payroll` and `employees:roles`, while still including `employees:schedule`. `ACCOUNTANT` gets `employees:read` only (headcount/payroll-cost reporting, not payroll edits or RBAC).

### Frontend

- `src/app/[locale]/(dashboard)/employees/page.tsx` + `src/components/employees/employees-view.tsx` — CRUD list; employee detail tabs (Profile / Schedule / Attendance / Commissions).
- `src/app/[locale]/(dashboard)/work-schedules/page.tsx` — **Decision:** a store-wide weekly grid is the more useful management view than per-employee-only; per-employee shift lists are reused on the employee detail tab.
- `src/app/[locale]/(dashboard)/attendance/page.tsx` — daily clock-in/out list + manual backfill entry + present/absent summary.
- `src/app/[locale]/(dashboard)/roles/page.tsx` — RBAC admin: role list, permission checkbox grid grouped by `module`, user-role assignment (with optional store scoping via `UserRole.storeId`).
- Employee performance dashboard — **Decision:** placed under `groups.reports` as `employee-performance`, not the new `groups.hr` group, same "reports live in the reports group" placement logic as Chunk C.
- Nav: new `groups.hr` (`Employees`, `Work Schedules`, `Attendance`, `Roles & Permissions`) + one appended entry to `groups.reports` (`Employee Performance`).
- i18n: `employees.*`, `workSchedules.*`, `attendance.*`, `commissionRules.*`, `roles.*`, `employeePerformance.*`.

### Exit criteria

Matches `ROADMAP.md` Week 17 verbatim: employee records (CRUD); role and permission management (RBAC); work schedule management; attendance tracking (basic); sales commission calculation; employee performance dashboard.

---

## Sequencing notes

- **A is foundational and independent** — `Invoice` already exists (Phase 2); nothing in A depends on B/C/D.
- **B is schema-independent of A** (its own `CustomerDebtPayment` ledger, separate from A's `InvoicePayment`) but reuses the exact "ledger + denormalized balance" pattern A establishes first — do A before B so that pattern is proven once (in a lower-stakes area, expenses) before being reused twice (loyalty + debt) in the same chunk. The two `sales.ts` touches (customer pricing, loyalty-earn) in B don't conflict with anything A touches.
- **C hard-depends on A** — expense analysis, tax report, and cash flow are literally built on Chunk A's `Expense`/`InvoicePayment`/revenue-base services; C cannot render meaningful numbers without A shipped. C also benefits from B being at least partially in place (CustomerDebt data feeds the AR side of the balance sheet) — same "don't verify against an empty database" logic Phase 3 Chunk D used, though C degrades gracefully (just less realistic) if B isn't done yet.
- **D is schema- and data-independent of A/B/C** (its own `Employee`/`WorkShift`/`AttendanceRecord`/`CommissionRule`/`SaleCommission` tables; commission calc only needs `Sale`/`User` data that has existed since Phase 2) — could technically be built in parallel by a second developer. Do it last anyway for two reasons: (1) its RBAC admin UI (Roles page) is most useful once *all* of Phase 4's new permission strings (`finance:expense`, `customers:update`, `employees:schedule`, etc.) already exist in the catalog — building it earlier means revisiting the UI as each prior chunk adds more strings; (2) commission calculation needs real `Sale` data to verify against, same "needs real data" precedent Phase 3 Chunk D used for reorder suggestions/spend analytics.
- **Net ordering: A → B → C → D.** A/B could be swapped or parallelized by two developers since they share no schema; C cannot move before A; D should structurally come last even though it has no hard data dependency.

Close out each chunk with a new dated entry in `Dev Log.md` — same format as every phase so far.

---

## Consolidated ARCHITECTURE.md vs. DATABASE.md divergences (quick reference)

| Item | ARCHITECTURE.md says | DATABASE.md says | Resolution |
|---|---|---|---|
| AR payments | names `invoice_payments`, no columns | silent | **Net-new**, designed in Chunk A |
| Customer segmentation | separate configurable `customer_segments` table | fixed `customer_type_enum` column (already live) | **Enum wins**, no new table |
| Loyalty ledger name | `customer_loyalty_points` | `loyalty_point_transactions` (fully specced, §10.2) | **DATABASE.md naming wins** (concrete schema precedent) |
| Debt repayments | names `customer_debt_payments`, no columns | `customer_debts` has no child payment table | **Net-new** `CustomerDebtPayment`, built atop the DATABASE.md-specced parent, Chunk B |
| Customer-specific pricing | not mentioned | not mentioned | **Net-new**, `CustomerPrice`, Chunk B (genuine gap, like Phase 3's `SupplierQuote`) |
| `journal_entries`/`tax_rates`/`payment_methods` | named, no columns | silent | **Skip** — pure aggregation over operational tables instead, Chunk C |
| `financial_periods` | named, no columns | silent | **Net-new**, designed in Chunk C, advisory-only close |
| RBAC tables (`roles`/`permissions`/`role_permissions`/`employee_roles`) | grouped under Employee module | these are Phase 0 §4 System Tables, already fully live | **No new schema** — `UserRole` already serves the `employee_roles` role; build the admin UI only, Chunk D |
| `work_schedules`/`attendance_records`/`commissions`/`commission_rules` | named, no columns | silent | **All net-new**, designed in Chunk D |

---

## Migration/RLS notes

Every new table needs the identical treatment already used in every prior phase's migrations: the `tenantId String @default(dbgenerated("NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)::uuid"))` column default in the Prisma model, then in the migration SQL — `GRANT SELECT, INSERT, UPDATE, DELETE ON <tables> TO app_user;`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` per table, and `CREATE POLICY "tenant_isolation" ON "<table>" USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);` per table.

Tables needing this treatment, by chunk:
- **A:** `expenses`, `expense_categories`, `invoice_payments` (+ `ALTER TABLE invoices ADD COLUMN amount_paid`, no RLS change needed there since `invoices` already has it).
- **B:** `loyalty_point_transactions`, `customer_debts`, `customer_debt_payments`, `customer_prices` (+ `ALTER TABLE customers ADD COLUMN ...` for the nine new columns, no RLS change needed, `customers` already has its policy).
- **C:** `financial_periods`.
- **D:** `employees`, `work_shifts`, `attendance_records`, `commission_rules`, `sale_commissions`. No RLS changes needed for `roles`/`permissions`/`role_permissions`/`user_roles` — already RLS'd since Phase 0's migration.

**Decision — no new `Store` counter fields this phase.** Every candidate (`Expense.reference`, `CustomerDebt`, `InvoicePayment`, `WorkShift`, `AttendanceRecord`) either uses free-text references or has no human-facing sequential-number requirement anywhere in the roadmap — same pattern as `SalePayment`/`StockMovement`, which have never needed one.
