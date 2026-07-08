# RetailOS — Development Roadmap

> **Version:** 1.0 | **Date:** 2026-07-07
> **Document Type:** Development Plan & Milestone Schedule
> **Audience:** Project lead, developers, AI coding assistants

---

## Guiding Principle

> *"Ship the smallest thing that proves the architecture works, then iterate."*

RetailOS is a large system. The roadmap is organized into **phases**, each of which produces a working, testable increment. No phase depends on a future phase being complete — each phase delivers standalone value.

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** Project scaffolding, developer tooling, and CI/CD pipeline.

| Task | Deliverable |
|---|---|
| Initialize Next.js 16 project with TypeScript strict mode | `package.json`, `tsconfig.json` |
| Configure Tailwind CSS 4 + shadcn/ui | `tailwind.config.ts`, `components.json` |
| Configure Prisma with PostgreSQL | `prisma/schema.prisma` (initial models: Tenant, User, Role, Permission) |
| Set up NextAuth.js v5 with JWT strategy | `lib/auth.ts`, login/register API routes |
| Implement RLS middleware (Prisma extension) | `lib/prisma.ts` with tenant context |
| Set up i18n (next-intl) with fr/ar/en | `i18n/fr.json`, `i18n/ar.json`, `i18n/en.json` |
| Docker Compose (Postgres, Redis, MinIO) | `docker-compose.yml` |
| ESLint + Prettier configuration | `.eslintrc.js`, `.prettierrc` |
| GitHub Actions CI (lint, type-check, test) | `.github/workflows/ci.yml` |
| Seed script (admin user, demo tenant, sample data) | `prisma/seed.ts` |

**Exit Criteria:** A developer can `docker compose up`, run the app, log in, and see a dashboard shell. RLS is active — logging in as Tenant A cannot see Tenant B's data.

---

## Phase 1 — Core Entities (Weeks 3–5)

**Goal:** Product catalog, categories, brands, units. The foundation for everything else.

### Week 3: Product Management
- Product CRUD (create, read, update, soft delete)
- Product categories (hierarchical tree, CRUD)
- Brand management (CRUD)
- Unit of measure management
- Barcode generation and management
- Product search (name, barcode, category)
- CSV/Excel import and export

### Week 4: Inventory Core
- Stock levels table with trigger-maintained updates
- Stock movements (immutable log)
- Stock level API (current levels per product per store)
- Low stock alerts
- Stock adjustment workflow

### Week 5: Supplier Management
- Supplier CRUD (directory, contacts, NIF, RC)
- Supplier-product mapping
- Basic supplier performance view (purchase history, delivery time)

**Exit Criteria:** A user can create products, organize them into categories, assign barcodes, and view stock levels. Suppliers can be registered and linked to products.

---

## Phase 2 — The Money Machine: POS (Weeks 6–9)

**Goal:** A fast, reliable Point of Sale that can handle daily supermarket operations. This is the module that proves the product works in a real store.

### Week 6: POS Core
- POS session management (open/close shift)
- Product lookup (barcode scan, name search)
- Shopping cart (add, remove, quantity, clear)
- Per-line discounts
- Multiple payment methods (cash, card, check, mixed)
- Cash drawer integration (open/close)
- Receipt printing
- Keyboard shortcuts

### Week 7: POS Transaction Flow
- Complete sale → stock movement → stock update (in transaction)
- Sale returns and refunds
- Held transactions (recall later)
- X/Z reports (end-of-shift reports)
- Sale history and search

### Week 8: Invoicing (DÉCRET 05-468)
- Invoice generation from sale
- Sequential numbering (database-enforced)
- All mandatory fields (NIF, NIS, RC, AI, TVA, tax stamp)
- TVA calculation (19%, 9%, 0%)
- Tax stamp (droit de timbre) calculation
- PDF generation and storage
- Invoice listing and search

### Week 9: POS Polish & Offline
- Offline mode (IndexedDB, sync queue)
- Customer selection at POS (for invoices)
- Walk-in customer (no account) support
- Performance optimization (sub-500ms transactions)
- Error recovery and conflict resolution

**Exit Criteria:** A cashier can process sales, print receipts, generate compliant invoices, and handle returns. The POS works offline and syncs when back online.

---

## Phase 3 — Operations: Purchasing & Warehousing (Weeks 10–13)

**Goal:** Complete the supply chain loop. Products come in (purchasing), are stored (warehouse), and go out (POS).

### Week 10: Purchasing
- Purchase order CRUD (draft → approved → ordered)
- PO approval workflow (manager approval required)
- Supplier quote comparison
- PO line items with TVA calculation

### Week 11: Delivery & Receiving
- Delivery recording (partial and full)
- Stock-in on delivery (triggers stock movements)
- Batch/lot tracking on delivery (expiration dates)
- Purchase returns

### Week 12: Warehousing
- Warehouse/zone/shelf/bin management
- Stock transfers between locations
- Transfer approval and receiving workflow
- Stock counting (full and partial)
- Count approval → stock adjustment

### Week 13: Procurement Polish
- Auto-reorder suggestions (basic: stock < reorder point)
- Supplier product catalog view
- Purchase analytics (spend by supplier, by category)
- Delivery performance tracking

**Exit Criteria:** A store manager can create purchase orders, receive deliveries (with batch tracking), transfer stock between locations, and perform inventory counts.

---

## Phase 4 — Finance & Customers (Weeks 14–17)

**Goal:** Complete the financial picture. Track revenue, expenses, taxes, and customer relationships.

### Week 14: Financial Management
- Expense tracking and categorization
- Revenue dashboard (daily, weekly, monthly)
- Profit & Loss report (simplified)
- TVA collected vs. TVA paid summary
- Payment tracking (accounts receivable)

### Week 15: Customer Management
- Customer CRUD
- Customer purchase history (from sales)
- Loyalty points system (earn on purchase, redeem for discount)
- Customer debt tracking (credit purchases)
- Customer segmentation (walk-in, regular, VIP, wholesale)
- Customer-specific pricing

### Week 16: Advanced Financial Reports
- Balance sheet (simplified)
- Cash flow statement
- Tax report (TVA declaration support)
- Expense analysis by category
- Margin analysis by product, category, brand
- Financial period management

### Week 17: Employee Management
- Employee records (CRUD)
- Role and permission management (RBAC)
- Work schedule management
- Attendance tracking (basic)
- Sales commission calculation
- Employee performance dashboard

**Exit Criteria:** Business owners can view P&L, track TVA, manage customer loyalty, and monitor employee performance. Accountants can export financial data.

---

## Phase 5 — Intelligence Layer (Weeks 18–22)

**Goal:** This is the differentiator. Add AI, optimization, and decision support that transforms RetailOS from "another POS" into a "retail intelligence platform."

### Week 18–19: AI Engine Setup & Forecasting
- Set up Python FastAPI microservice
- Historical sales data pipeline (export from PostgreSQL)
- Demand forecasting with Prophet
- Seasonality detection (Ramadan, Eid, holidays, back-to-school)
- Forecast accuracy tracking (MAPE)

### Week 20: Inventory Optimization
- Reorder point calculation (based on forecast + lead time + safety stock)
- Economic Order Quantity (EOQ) calculation
- Safety stock calculation (based on demand variability + service level)
- Expiration prediction (which products will expire before sale)
- Waste reduction recommendations (markdown suggestions)

### Week 21: Supplier Ranking (MCDA)
- AHP criteria weighting interface (pairwise comparison)
- TOPSIS supplier ranking
- PROMETHEE supplier ranking (alternative method)
- Supplier score history and trends
- Purchase recommendation engine (what to order, from whom, how much)

### Week 22: Scenario Simulation & Dashboard
- "What-if" scenario modeling (price changes, demand shifts, cost variations)
- AI recommendations feed (real-time, in-app notifications)
- Optimization results dashboard
- Financial impact predictions

**Exit Criteria:** The AI engine produces demand forecasts, ranks suppliers using MCDA methods, recommends purchase quantities, predicts expirations, and allows scenario simulation.

---

## Phase 6 — Polish & Launch (Weeks 23–26)

**Goal:** Production readiness, performance, security hardening, and documentation.

### Week 23: Reports & BI
- Pre-built report templates (sales, inventory, purchase, financial, employee)
- Report scheduling (generate and email)
- Dashboard customization (per role)
- Data export (PDF, Excel, CSV) on all reports
- KPI widgets library

### Week 24: Performance & Security
- Database query optimization (EXPLAIN ANALYZE, indexes)
- API response time optimization (< 300ms reads, < 1s writes)
- Load testing (simulate 100 concurrent users)
- Security audit (penetration testing basics)
- Rate limiting on all API endpoints
- CORS hardening
- CSP headers

### Week 25: Multi-Store & Multi-Tenant Polish
- Multi-store dashboard (aggregate view across stores)
- Store-level permissions (user can access only assigned stores)
- Cross-store stock transfers (final polish)
- Tenant onboarding flow (self-service or admin-assisted)
- Subscription management UI (admin panel)

### Week 26: Launch Preparation
- Production deployment script
- Backup and restore procedures
- Monitoring setup (basic)
- Error tracking (Sentry or equivalent)
- User documentation (getting started guide)
- Admin documentation (deployment, troubleshooting)
- Demo data package (for sales demos)

**Exit Criteria:** The system is production-ready. A new tenant can be onboarded, set up their store, add products, process sales, and view reports. The AI engine produces actionable recommendations.

---

## Future Phases (Post-Launch)

| Phase | Timeline | Focus |
|---|---|---|
| **V1.1** | Month 7–8 | Mobile apps (cashier PWA, manager app), barcode scanner integration |
| **V1.2** | Month 9–10 | E-commerce module, delivery optimization, customer-facing portal |
| **V1.3** | Month 11–12 | IoT (electronic scales, electronic shelf labels), RFID pilot |
| **V2.0** | Month 13–18 | Marketplace, multi-vendor, advanced computer vision, voice assistant |
| **V2.1** | Month 19–24 | Store layout optimization, queue optimization, autonomous inventory |

---

## Effort Estimation

| Phase | Duration | Core Effort | Risk Level |
|---|---|---|---|
| Phase 0: Foundation | 2 weeks | Setup, config, auth | Low |
| Phase 1: Core Entities | 3 weeks | Products, inventory, suppliers | Low |
| Phase 2: POS | 4 weeks | POS, invoicing, offline | **High** (offline is complex) |
| Phase 3: Purchasing & Warehousing | 4 weeks | PO, deliveries, transfers, counting | Medium |
| Phase 4: Finance & Customers | 4 weeks | Invoicing, CRM, HR, reports | Medium |
| Phase 5: Intelligence Layer | 5 weeks | AI, MCDA, optimization, simulation | **High** (ML accuracy) |
| Phase 6: Polish & Launch | 4 weeks | Performance, security, docs | Medium |
| **Total** | **26 weeks (~6 months)** | | |

---

## Module Dependencies

```
Auth & Tenancy (Phase 0)
        │
        ▼
Product Management ────────────────┐
(Phase 1)                         │
        │                         │
        ▼                         │
Inventory Core ◄──────────────────┤
(Phase 1)                         │
        │                         │
        ▼                         │
Supplier Management ◄─────────────┤
(Phase 1)                         │
        │                         │
        ▼                         ▼
POS (Phase 2) ◄─── Purchasing (Phase 3)
        │                 │
        ▼                 ▼
Invoicing (Phase 2)   Warehousing (Phase 3)
        │                 │
        └────────┬────────┘
                 ▼
        Finance & Customers (Phase 4)
                 │
                 ▼
        Reports & BI (Phase 4)
                 │
                 ▼
        AI & Optimization (Phase 5)
                 │
                 ▼
        Polish & Launch (Phase 6)
```

---

## Critical Path

The **critical path** (longest chain of dependent tasks) is:

1. Auth & Tenancy (2 weeks)
2. Product Management (1 week)
3. Inventory Core (1 week)
4. POS Core (2 weeks)
5. POS Transaction Flow (1 week)
6. Invoicing (1 week)
7. Finance Management (1 week)
8. Financial Reports (1 week)
9. AI Engine Setup (1 week)
10. Forecasting (2 weeks)
11. Inventory Optimization (1 week)
12. Supplier Ranking (1 week)
13. Scenario Simulation (1 week)

**Critical path total: ~16 weeks.** Everything else can be parallelized.

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Offline POS sync conflicts | High | High | Start with simple queue-based sync. Implement conflict UI early. Test with real offline scenarios. |
| Algerian invoice compliance gaps | Medium | High | Review DÉCRET 05-468 with an Algerian accountant before Phase 2. |
| AI forecast accuracy too low | Medium | Medium | Start with simple models (moving average). Add Prophet/ARIMA progressively. Show confidence intervals. |
| Performance with large datasets | Medium | High | Implement pagination from day one. Use database indexes. Load test at each phase. |
| Scope creep | High | Medium | Strict phase boundaries. New features go into the next phase, never the current one. |
| RLS policy bugs causing data leaks | Low | Critical | Write RLS integration tests for every new table. Test with multi-tenant seed data. |