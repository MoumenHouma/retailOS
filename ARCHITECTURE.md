# RetailOS — System Architecture

> **Version:** 1.0 | **Date:** 2026-07-07
> **Document Type:** Software Architecture Specification
> **Audience:** AI coding assistants, developers, technical leads

---

## 1. Architectural Overview

RetailOS follows a **monolithic frontend + modular backend** architecture. The frontend is a single Next.js application. The backend uses Next.js API Routes for CRUD operations and a separate Python microservice for AI/optimization workloads.

This approach was chosen because:
- It simplifies deployment for the initial market (Algeria, where devops expertise is limited).
- It avoids the operational complexity of microservices for V1.
- The AI engine is the only component that benefits from a separate runtime (Python for ML libraries).
- The architecture can evolve toward microservices as the user base grows.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Browser (PWA)  │  │  Mobile (Future)  │  │  Supplier Portal  │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬──────────┘  │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway / CDN                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Nginx / Caddy  →  TLS Termination  →  Static Assets (CDN)  │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Layer                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │              Next.js 16 (App Router)                        │     │
│  │                                                              │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │     │
│  │  │   Auth   │ │  CRUD    │ │   POS    │ │   Reports    │  │     │
│  │  │  Module  │ │  APIs    │ │   APIs   │ │    APIs      │  │     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │     │
│  │  │Inventory │ │Purchase  │ │ Finance  │ │  Real-time   │  │     │
│  │  │  APIs    │ │  APIs    │ │   APIs   │ │ (Socket.io)  │  │     │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │     │
│  └──────────────────────────┬─────────────────────────────────┘     │
│                              │                                       │
│  ┌──────────────────────────┼─────────────────────────────────┐     │
│  │              Service Layer (server/services/)               │     │
│  │  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │     │
│  │  │  Auth      │ │ Product   │ │ Inventory │ │  POS     │  │     │
│  │  │  Service   │ │  Service  │ │  Service  │ │ Service  │  │     │
│  │  └────────────┘ └───────────┘ └───────────┘ └──────────┘  │     │
│  │  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │     │
│  │  │ Purchase   │ │ Finance   │ │  Report   │ │  Invoice │  │     │
│  │  │  Service   │ │  Service  │ │  Service  │ │ Service  │  │     │
│  │  └────────────┘ └───────────┘ └───────────┘ └──────────┘  │     │
│  └──────────────────────────┬─────────────────────────────────┘     │
│                              │                                       │
│  ┌──────────────────────────┼─────────────────────────────────┐     │
│  │              Repository Layer (server/repositories/)        │     │
│  │            Prisma ORM  →  PostgreSQL (RLS)                  │     │
│  └──────────────────────────┬─────────────────────────────────┘     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   PostgreSQL 16+  │ │      Redis       │ │  Object Storage  │
│   (Primary DB)    │ │  (Cache + Jobs)  │ │  (S3/MinIO)      │
│                   │ │                  │ │  Files, Images,  │
│   RLS Policies    │ │  BullMQ Queues   │ │  PDFs, Exports   │
│   per tenant_id   │ │  Session Store   │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  AI / Optimization Engine                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │              Python FastAPI Microservice                     │     │
│  │                                                              │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │     │
│  │  │  Forecasting  │ │  Supplier    │ │  Inventory         │  │     │
│  │  │  (Prophet,    │ │  Ranking     │ │  Optimization      │  │     │
│  │  │   ARIMA,      │ │  (AHP,       │ │  (EOQ, Reorder     │  │     │
│  │  │   XGBoost)    │ │   TOPSIS,    │ │   Point, Safety    │  │     │
│  │  │              │ │   PROMETHEE)  │ │   Stock)           │  │     │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘  │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │     │
│  │  │  Waste       │ │  Scenario    │ │  Dynamic           │  │     │
│  │  │  Prediction  │ │  Simulation  │ │  Pricing           │  │     │
│  │  └──────────────┘ └──────────────┘ └────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                              │                                       │
│               Communication: REST API + Redis pub/sub                │
│               Data access: Read replica of PostgreSQL               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenancy Strategy

### 2.1 Approach: Row-Level Security (RLS)

RetailOS uses **PostgreSQL Row-Level Security** for tenant isolation. This means:

- All business tables have a `tenant_id` column (UUID, NOT NULL, indexed).
- PostgreSQL RLS policies ensure that every query automatically filters by the authenticated tenant's ID.
- A database role (`app_user`) has RLS enabled. The application sets `SET app.current_tenant_id = '<uuid>'` at connection time using a PostgreSQL session variable.
- This provides **database-level isolation** — even if application code has a bug, data from one tenant cannot leak to another.

### 2.2 Tenant Model

```
Platform (RetailOS)
│
├── Tenant A (Supermarché El Amel)
│   ├── Store 1 (Central)
│   │   ├── Warehouse A
│   │   └── POS Terminal 1, 2, 3
│   └── Store 2 (Bab Ezzouar)
│       ├── Warehouse B
│       └── POS Terminal 4, 5
│
├── Tenant B (Épicerie Moderne)
│   └── Store 1 (Oran Centre)
│       └── POS Terminal 1
│
└── Tenant C (Alimentation Générale)
    ├── Store 1 (Constantine)
    └── Store 2 (Annaba)
```

### 2.3 Connection Management

On every authenticated API request:
1. Extract `tenant_id` from the JWT/session.
2. Execute `SET LOCAL app.current_tenant_id = '<tenant_id>'` at the start of a transaction.
3. RLS policies use `current_setting('app.current_tenant_id')` to filter rows.
4. The Prisma client middleware handles this automatically via a `$extends` plugin.

---

## 3. Module Architecture

Each module follows the same layered architecture:

```
Module (e.g., Products)
├── API Routes (app/api/products/)
│   ├── route.ts          → GET (list), POST (create)
│   └── [id]/
│       └── route.ts      → GET (by id), PUT (update), DELETE (soft delete)
├── Service (server/services/product.service.ts)
│   → Business logic, validation, authorization checks
├── Repository (server/repositories/product.repository.ts)
│   → Prisma queries, database operations
├── Components (components/products/)
│   ├── ProductList.tsx       → Table with search, filter, pagination
│   ├── ProductForm.tsx       → Create/Edit form
│   ├── ProductDetail.tsx     → Detail view
│   └── ProductDeleteDialog.tsx
├── Hooks (hooks/useProducts.ts)
│   → TanStack Query hooks for data fetching and mutations
├── Validators (lib/validators/product.ts)
│   → Zod schemas for input validation
└── Types (types/product.ts)
    → TypeScript interfaces and types
```

---

## 4. Module Specifications

### 4.1 Authentication Module

**Responsibility:** User identity, sessions, password management.

**Flow:**
1. User submits email/password to `/api/auth/login`.
2. Server validates credentials (bcrypt hash comparison).
3. Server creates JWT containing `userId`, `tenantId`, `roles`, `storeId` (if applicable).
4. JWT stored in httpOnly, secure, SameSite cookie.
5. Client redirects to dashboard.
6. On every subsequent request, middleware extracts JWT, sets `app.current_tenant_id` in PostgreSQL.
7. RBAC checks performed at service layer.

**Key Decisions:**
- JWT expiration: 24 hours (refresh token: 7 days).
- Password requirements: minimum 8 characters, one uppercase, one digit.
- Account lockout: 5 failed attempts → 15-minute lockout.
- Session invalidation: on password change, on logout.

### 4.2 Product Management Module

**Responsibility:** Product catalog, categories, brands, units, barcodes.

**Data Model:**
- `products` — core product entity
- `product_categories` — hierarchical category tree (adjacency list with `parent_id`)
- `brands` — product brands
- `units` — units of measure (piece, kg, liter, box, pack)
- `product_barcodes` — multiple barcodes per product (EAN-13, Code-128, internal)
- `product_pricing` — price tiers (selling, wholesale, promotional)
- `product_batches` — batch/lot tracking with expiration dates

**Business Rules:**
- A product can belong to one category (leaf node of the hierarchy).
- A product can have multiple barcodes but exactly one primary barcode.
- Deleting a category reassigns its products to the parent category.
- Product prices are versioned (price history is maintained).
- Batch expiration alerts are generated 30, 15, and 7 days before expiry.

### 4.3 Inventory Management Module

**Responsibility:** Stock tracking, movements, counting, transfers, alerts.

**Data Model:**
- `stock_levels` — current stock per product per location (denormalized for performance, updated by triggers)
- `stock_movements` — immutable log of all stock changes (every IN, OUT, ADJUSTMENT)
- `stock_transfers` — transfer orders between locations
- `stock_transfer_items` — line items of a transfer
- `stock_counts` — inventory count sessions
- `stock_count_items` — counted quantities per product
- `stock_adjustments` — adjustments resulting from counts

**Business Rules:**
- `stock_levels` is updated via database triggers on `stock_movements` — the application never writes to `stock_levels` directly.
- Every stock movement must reference a `stock_movement_type`: PURCHASE_IN, SALE_OUT, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, WRITE_OFF.
- Stock cannot go below zero. The database enforces this with a CHECK constraint on the trigger logic.
- Inventory counts create pending adjustments that must be approved by a manager.
- Transfers between locations must be received (confirmed) before stock is added at the destination.

### 4.4 Point of Sale Module

**Responsibility:** Fast, reliable checkout with offline capability.

**Data Model:**
- `sales` — completed sales transactions
- `sale_items` — line items of a sale
- `sale_payments` — payment records (cash, card, check, mixed)
- `sale_discounts` — discounts applied (per-line or per-ticket)
- `sale_returns` — return transactions
- `sale_return_items` — returned items
- `pos_sessions` — cashier shift sessions (open/close cash drawer)
- `pos_cash_movements` — cash drawer entries (open, close, withdrawal, deposit, difference)

**Offline Strategy:**
- The POS uses a **local-first** approach via IndexedDB (using Dexie.js or similar).
- When offline, all transactions are stored locally with a sync queue.
- When connectivity is restored, transactions are pushed to the server in order.
- Conflict resolution: server is authoritative for stock levels. If a conflict occurs (e.g., product sold out while offline), the cashier is notified.
- Product catalog is cached locally and periodically synced.

**POS Screen Layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│  RetailOS POS                                    Cashier: Ahmed  │
├──────────────────────────────────────┬───────────────────────────┤
│                                      │  Current Sale            │
│  Product Search / Barcode            │                           │
│  ┌──────────────────────────────┐    │  ┌─────────────────────┐  │
│  │  [Scan barcode or search]   │    │  │ Lait 1L    2x 150 DA│  │
│  └──────────────────────────────┘    │  │ Pain       1x  30 DA│  │
│                                      │  │ ...                 │  │
│  Quick Categories                   │  │                     │  │
│  [Lait] [Pain] [Boissons] [Viande]  │  ├─────────────────────┤  │
│  [Fruits] [Conserves] [Hygiène]     │  │ Sous-total:   330 DA│  │
│                                      │  │ Remise:      -30 DA│  │
│  Recent Products                     │  │ TVA 19%:      57 DA│  │
│  ┌──────────────────────────────┐    │  │ Timbre:         4 DA│  │
│  │ Lait 1L  │ 150 DA │ [+]     │    │  │ TTC:         361 DA│  │
│  │ Pain    │  30 DA │ [+]     │    │  └─────────────────────┘  │
│  │ ...     │        │          │    │                           │
│  └──────────────────────────────┘    │  [Espèces] [Carte]      │
│                                      │  [Chèque]  [Mixte]      │
├──────────────────────────────────────┤                           │
│  F1:Rechercher F2:Catégorie F3:Hold  │  [ANNULER]  [ENCAISSER] │
│  F4:Remise   F5:Paiement F6:Retour   │                           │
└──────────────────────────────────────┴───────────────────────────┘
```

**Keyboard Shortcuts:**
| Key | Action |
|---|---|
| F1 | Focus search bar |
| F2 | Open category browser |
| F3 | Hold current transaction |
| F4 | Apply discount |
| F5 | Open payment dialog |
| F6 | Process return |
| F7 | Open cash drawer |
| F8 | Print last receipt |
| F9 | Toggle customer (add to sale) |
| F10 | Add quantity |
| F11 | Remove last item |
| F12 | Complete sale (enter payment) |
| Esc | Cancel / go back |

### 4.5 Purchasing Module

**Responsibility:** Purchase orders, supplier quotes, delivery tracking, AI reorder suggestions.

**Data Model:**
- `purchase_orders` — purchase order headers
- `purchase_order_items` — line items
- `supplier_quotes` — quotes received from suppliers
- `supplier_quote_items` — quote line items
- `purchase_deliveries` — delivery receipts
- `purchase_delivery_items` — delivery line items (may be partial)
- `purchase_returns` — return to supplier

**Business Rules:**
- Purchase order statuses: DRAFT → PENDING_APPROVAL → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED
- A purchase order must be approved by a Store Manager or Business Owner before being sent to the supplier.
- Partial deliveries are allowed and tracked.
- The AI engine can generate suggested purchase orders based on:
  - Current stock levels vs. reorder points
  - Forecasted demand
  - Supplier rankings (MCDA scores)
  - Lead times
  - Current promotions

### 4.6 Supplier Management Module

**Responsibility:** Supplier directory, evaluation, MCDA-based ranking.

**Data Model:**
- `suppliers` — supplier master data
- `supplier_contacts` — multiple contacts per supplier
- `supplier_products` — products offered by each supplier (mapping to internal products)
- `supplier_evaluations` — periodic evaluation records
- `supplier_evaluation_criteria` — evaluation criteria definitions (price, quality, delivery, etc.)
- `supplier_scores` — MCDA ranking results (AHP weights, TOPSIS/PROMETHEE scores)

**MCDA Supplier Ranking Process:**

The supplier evaluation uses a two-stage approach:

**Stage 1 — AHP (Analytic Hierarchy Process):**
- Define criteria: Price, Quality, Delivery Time, Reliability, Payment Terms, Range of Products.
- Build pairwise comparison matrices.
- Calculate criteria weights (eigenvector method).
- Check consistency ratio (CR < 0.10).

**Stage 2 — TOPSIS (Technique for Order Preference by Similarity to Ideal Solution):**
- Build the decision matrix (suppliers × criteria).
- Normalize the matrix.
- Apply AHP weights from Stage 1.
- Calculate distances to positive ideal and negative ideal solutions.
- Calculate closeness coefficient for each supplier.
- Rank suppliers by closeness coefficient.

**Alternative: PROMETHEE** can be used when criteria have preference functions that are not linear (e.g., "delivery in 2 days is ideal, 3-5 days is acceptable, >5 days is unacceptable").

### 4.7 Financial Management Module

**Responsibility:** Compliant invoicing, expense tracking, tax calculation, financial reporting.

**Data Model:**
- `invoices` — sales invoices (factures)
- `invoice_items` — invoice line items
- `invoice_payments` — payments received against invoices
- `expenses` — business expenses
- `expense_categories` — expense classification
- `tax_rates` — configurable tax rates (default: TVA 19%, 9%, 0%)
- `payment_methods` — cash, card, check, transfer
- `financial_periods` — fiscal period management
- `journal_entries` — simplified double-entry journal (for reports)

**Invoice Generation (DÉCRET 05-468 Compliance):**

```
┌─────────────────────────────────────────────────────────────┐
│                     FACTURE N° 2026-00042                   │
│                     Date: 07/07/2026                        │
│                                                              │
│  Fournisseur:                    Client:                     │
│  Supermarché El Amel             Client Nom                  │
│  NIF: 001216000123456            NIF: 001216000789012        │
│  NIS: 001216000123               Adresse Client              │
│  RC: 16/00-1234567B21            ─────────────────────       │
│  AI: 16240123456                                              │
│  Adresse: Rue des Frères, Alger                              │
│                                                              │
│  ┌────┬──────────────┬──────┬───────┬────────┬──────────┐   │
│  │ N° │ Désignation  │ Qté  │ Unité │P.U. HT │  Montant  │   │
│  ├────┼──────────────┼──────┼───────┼────────┼──────────┤   │
│  │  1 │ Lait UHT 1L  │  24  │  unit │ 150,00 │  3 600,00│   │
│  │  2 │ Pain blanc   │  10  │  unit │  30,00 │    300,00│   │
│  │  3 │ Huile 5L     │   5  │  unit │ 850,00 │  4 250,00│   │
│  ├────┴──────────────┴──────┴───────┴────────┼──────────┤   │
│  │                                    Total HT│  8 150,00│   │
│  │                                    TVA 19%  │  1 548,50│   │
│  ├─────────────────────────────────────────────┼──────────┤   │
│  │                                    Total TTC│  9 698,50│   │
│  │                             Droit de timbre│      4,00│   │
│  │                             Net à payer   │  9 702,50│   │
│  └─────────────────────────────────────────────┴──────────┘   │
│                                                              │
│  Arrêtée la présente facture à la somme de:                  │
│  Neuf mille sept cent deux dinars et cinquante centimes.     │
│                                                              │
│  Conditions de paiement: À réception                          │
│  Signature et cachet                                          │
└─────────────────────────────────────────────────────────────┘
```

**Invoice Numbering:**
- Format: `YYYY-NNNNN` (year + 5-digit sequential number)
- Enforced at database level: sequence per `tenant_id`, no gaps
- Reset annually (or configurable)

**Tax Stamp Calculation:**
```
tax_stamp = max(100, round(TTC_total * 0.01))
net_to_pay = TTC_total + tax_stamp
```

### 4.8 Customer Management (CRM) Module

**Responsibility:** Customer records, loyalty, segments, debt tracking.

**Data Model:**
- `customers` — customer master data
- `customer_loyalty_points` — point balances and transactions
- `customer_segments` — customer segments (VIP, Regular, New, etc.)
- `customer_debts` — outstanding debts (for credit customers)
- `customer_debt_payments` — debt repayment records

**Loyalty System:**
- Points earned: 1 point per 100 DZD spent (configurable per tenant).
- Points can be redeemed for discounts (e.g., 100 points = 50 DA discount).
- Points expire after 12 months of inactivity (configurable).
- Points history is immutable (append-only).

### 4.9 Employee Management Module

**Responsibility:** Staff records, roles, schedules, attendance, commissions.

**Data Model:**
- `employees` — employee records
- `roles` — role definitions
- `permissions` — granular permission definitions
- `role_permissions` — many-to-many role-permission mapping
- `employee_roles` — many-to-many employee-role mapping
- `work_schedules` — shift schedules
- `attendance_records` — clock-in/clock-out records
- `commissions` — sales commission calculations
- `commission_rules` — commission configuration per role/product/category

### 4.10 Reports & BI Module

**Responsibility:** Dashboards, reports, data export, scheduled reports.

**Available Reports:**

| Report | Description | Key Metrics |
|---|---|---|
| Sales Summary | Daily/weekly/monthly sales overview | Revenue, transaction count, average basket, top products |
| Inventory Status | Current stock levels and health | Stock value, low stock alerts, overstock, expiring items |
| Purchase Analysis | Purchasing patterns and supplier performance | Spend by supplier, delivery performance, cost trends |
| Financial Report | P&L, balance sheet, cash flow | Revenue, COGS, gross margin, net profit, TVA collected/paid |
| Employee Performance | Sales by employee, attendance | Sales per employee, commissions, hours worked |
| Customer Analytics | Customer behavior and segmentation | Top customers, retention rate, average spend, loyalty metrics |
| Waste Report | Expired and written-off products | Waste value by category, waste rate, predicted waste |
| AI Recommendations | AI-generated insights and suggestions | Forecast accuracy, savings from optimization, supplier scores |

### 4.11 AI & Optimization Engine

**Communication Pattern:**
- The Next.js backend calls the Python FastAPI service via internal HTTP.
- For long-running jobs (forecasting, simulation), the Next.js backend enqueues a BullMQ job. A worker calls the Python API and stores results.
- Real-time results are pushed to the client via Socket.io.

**Algorithms:**

| Algorithm | Purpose | Input | Output |
|---|---|---|---|
| Prophet / ARIMA | Demand Forecasting | Historical sales, events calendar | Predicted demand per product per day |
| AHP | Criteria Weighting | Pairwise comparisons | Criteria weights (sum = 1) |
| TOPSIS | Supplier Ranking | Supplier data, AHP weights | Ranked supplier list with scores |
| PROMETHEE | Supplier Ranking (alt.) | Supplier data, preference functions | Ranked supplier list with flows |
| EOQ | Economic Order Quantity | Annual demand, ordering cost, holding cost | Optimal order quantity |
| Reorder Point | When to Reorder | Daily demand, lead time, safety stock | Reorder point (units) |
| Safety Stock | Buffer Calculation | Demand variability, lead time variability, service level | Safety stock (units) |
| XGBoost | Sales Prediction | Product features, promotions, seasonality | Predicted sales volume |
| Expiration Prediction | Waste Prevention | Product age, sales velocity, expiration date | Probability of expiration before sale |
| Simulation | Scenario Modeling | Base data, what-if parameters | Impact on revenue, cost, profit |

---

## 5. Data Flow — Key Processes

### 5.1 Sale Transaction Flow

```
Customer at POS
      │
      ▼
Cashier scans/adds products → Cart (client-side)
      │
      ▼
Apply discounts (if any) → Recalculate totals
      │
      ▼
Select payment method(s) → Cash, Card, Check, Mixed
      │
      ▼
[OFFLINE?] → Store in IndexedDB sync queue
[ONLINE]  → POST /api/pos/sales
      │
      ▼
Server validates stock availability
      │
      ├── Stock OK → Create sale → Record stock movements → Update stock_levels
      │                    │
      │                    ▼
      │              Generate receipt → Open cash drawer
      │                    │
      │                    ▼
      │              [Invoice requested?] → Generate compliant invoice
      │
      └── Stock insufficient → Return error → Cashier notified → Remove item or adjust
```

### 5.2 Purchase Order Flow

```
Low stock alert / AI suggestion
      │
      ▼
Create purchase order (DRAFT)
      │
      ▼
Add items (from suggestions or manual)
      │
      ▼
Request supplier quotes (optional)
      │
      ▼
Compare quotes + AI supplier ranking
      │
      ▼
Submit for approval → PENDING_APPROVAL
      │
      ▼
Manager/Owner approves → APPROVED
      │
      ▼
Send to supplier → ORDERED
      │
      ▼
Supplier delivers → Record delivery (partial or full)
      │
      ▼
Verify delivery → Update stock (IN movements) → Update stock_levels
      │
      ▼
[All items received?] → RECEIVED → CLOSED
[Partial?] → PARTIALLY_RECEIVED → Await remaining
```

### 5.3 Invoice Generation Flow

```
Sale completed + customer requests invoice
      │
      ▼
Generate sequential invoice number (YYYY-NNNNN)
      │
      ▼
Populate mandatory fields (DÉCRET 05-468):
  - Invoice number, date
  - Seller: NIF, NIS, RC, AI, name, address (from tenant record)
  - Buyer: name, address, NIF (from customer record, if available)
  - Line items: description, quantity, unit, unit price HT, amount HT
      │
      ▼
Calculate:
  - Total HT (sum of line amounts)
  - TVA per rate (19%, 9%, 0%)
  - Total TTC
  - Tax stamp = max(100, round(TTC * 0.01))
  - Net à payer = TTC + tax stamp
      │
      ▼
Generate amount in words (French)
      │
      ▼
Generate PDF → Store in object storage
      │
      ▼
Return PDF to POS for printing/emailing
```

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
Client → POST /api/auth/login (email, password)
    │
    ▼
Server: Validate with bcrypt → Generate JWT (userId, tenantId, roles)
    │
    ▼
Set httpOnly cookie: `retailos-session`
    │
    ▼
Client → Subsequent requests with cookie
    │
    ▼
Middleware: Verify JWT → Extract tenantId → Set PostgreSQL RLS context
    │
    ▼
API Route: Execute business logic (auto-filtered by RLS)
```

### 6.2 RBAC Model

Permissions are granular strings like:
- `products:read`, `products:create`, `products:update`, `products:delete`
- `inventory:read`, `inventory:adjust`, `inventory:count`, `inventory:transfer`
- `pos:operate`, `pos:refund`, `pos:discount`, `pos:open_drawer`
- `purchases:read`, `purchases:create`, `purchases:approve`
- `finance:read`, `finance:invoice`, `finance:report`
- `employees:read`, `employees:manage`
- `reports:view`, `reports:export`
- `ai:view_recommendations`, `ai:run_forecast`

Roles are collections of permissions:

| Role | Permissions |
|---|---|
| `PLATFORM_ADMIN` | Full platform access, cross-tenant |
| `BUSINESS_OWNER` | All permissions within tenant |
| `STORE_MANAGER` | All except tenant settings and user management |
| `CASHIER` | `pos:*`, `products:read`, `customers:read` |
| `INVENTORY_CLERK` | `inventory:*`, `products:read`, `warehouses:*` |
| `ACCOUNTANT` | `finance:*`, `reports:*`, `products:read` |

### 6.3 Audit Logging

Every mutation (create, update, delete) must be logged in an `audit_logs` table:
- `id` (UUID)
- `tenant_id` (UUID)
- `user_id` (UUID, who performed the action)
- `entity_type` (string, e.g., "product", "sale")
- `entity_id` (UUID)
- `action` (string: "create", "update", "delete", "approve")
- `changes` (JSONB, the diff of what changed)
- `ip_address` (string)
- `user_agent` (string)
- `created_at` (timestamp)

---

## 7. Offline Strategy (POS)

The POS module must function without internet. Here is the detailed approach:

### 7.1 Local Storage (IndexedDB via Dexie.js)

Tables stored locally:
- `local_products` — product catalog (synced periodically)
- `local_sales` — completed sales (pending sync)
- `local_stock_levels` — cached stock levels
- `local_payments` — payment methods config
- `local_settings` — tenant settings, store info

### 7.2 Sync Protocol

```
[ONLINE] ──────────────────────────────────────────
  │
  ├── Periodic sync (every 5 min): Pull product updates, price changes
  ├── On sale: Push immediately to server
  └── On stock change: Push immediately

[OFFLINE] ─────────────────────────────────────────
  │
  ├── Sales stored in IndexedDB with local ID
  ├── Stock decremented locally (optimistic)
  ├── Conflicts flagged for resolution
  └── User sees "Offline Mode" indicator

[BACK ONLINE] ────────────────────────────────────
  │
  ├── Detect connectivity change (navigator.onLine + heartbeat)
  ├── Push queued sales to server (in order)
  ├── For each pushed sale:
  │   ├── Server validates stock
  │   ├── If OK: Confirm sale, update server stock
  │   └── If conflict: Flag for cashier resolution
  ├── Pull latest product/stock data
  └── Clear sync queue
```

### 7.3 Conflict Resolution

- **Server is authoritative** for stock levels.
- If a product was sold out on the server while the cashier was offline, the sale is rejected and the cashier is prompted to remove the item.
- If prices changed while offline, the cashier is notified and can choose to use the new price or the price at time of sale.
- All conflicts are logged for review.

---

## 8. Real-time Architecture

### 8.1 Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `stock:alert` | Server → Client | Low stock or expiration alert |
| `sale:completed` | Server → Client | New sale notification (dashboard) |
| `notification:new` | Server → Client | System notification |
| `ai:recommendation` | Server → Client | New AI recommendation available |
| `sync:status` | Bidirectional | Online/offline/syncing status |
| `pos:session` | Server → Client | POS session status updates |

### 8.2 Rooms

Clients join Socket.io rooms based on their tenant and store:
- `tenant:{tenantId}` — all users of a tenant
- `store:{storeId}` — all users of a specific store
- `user:{userId}` — private channel for specific user notifications

---

## 9. Deployment Architecture

### 9.1 Development (Docker Compose)

```
docker-compose.yml
├── nextjs (app)          → localhost:3000
├── postgres              → localhost:5432
├── redis                 → localhost:6379
├── python-ai             → localhost:8000
└── minio                 → localhost:9000 (object storage)
```

### 9.2 Production

```
┌─────────────────────────────────────────────┐
│                 Nginx / Caddy                │
│         (TLS, Load Balancing, Static)        │
└──────────┬──────────────────┬────────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │  Next.js 1  │   │  Next.js 2  │   (Horizontal scaling)
    └──────┬──────┘   └──────┬──────┘
           │                  │
    ┌──────▼──────────────────▼──────┐
    │         PostgreSQL 16+          │
    │    (Primary + Read Replicas)    │
    └────────────────────────────────┘
           │
    ┌──────▼──────┐   ┌──────────────┐   ┌──────────────┐
    │   Redis     │   │  FastAPI AI  │   │  MinIO / S3  │
    │ (Cache+Jobs)│   │  Engine      │   │ (Files/PDFs) │
    └─────────────┘   └──────────────┘   └──────────────┘
```

### 9.3 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/retailos
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=<random-32-chars>
NEXTAUTH_URL=http://localhost:3000
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d
BCRYPT_SALT_ROUNDS=12

# Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=retailos
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# AI Engine
AI_ENGINE_URL=http://localhost:8000

# App
APP_URL=http://localhost:3000
APP_NAME=RetailOS
DEFAULT_LOCALE=fr
DEFAULT_CURRENCY=DZD
DEFAULT_TVA_RATE=19
```

---

## 10. Error Handling Strategy

### 10.1 Error Categories

| Category | HTTP Status | Description | Example |
|---|---|---|---|
| Validation Error | 422 | Input fails Zod schema | Missing required field |
| Not Found | 404 | Resource doesn't exist | Product ID invalid |
| Conflict | 409 | Business rule violation | Duplicate barcode |
| Forbidden | 403 | Insufficient permissions | Cashier tries to approve PO |
| Unauthorized | 401 | Not authenticated | Expired session |
| Rate Limited | 429 | Too many requests | Brute force attempt |
| Internal Error | 500 | Unexpected server error | Database connection lost |
| Service Unavailable | 503 | External service down | AI engine unreachable |

### 10.2 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les données fournies sont invalides.",
    "details": [
      { "field": "email", "message": "Format d'email invalide" },
      { "field": "nif", "message": "Le NIF doit contenir 15 caractères" }
    ]
  }
}
```

All error messages visible to users MUST be in the current locale (French by default for Algerian users).