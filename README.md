# RetailOS

**Multi-store retail management for Algerian shops: point of sale, inventory, purchasing, invoicing and finance, with demand forecasting and inventory optimization built in.**

Next.js 16 · PostgreSQL 16 (row-level security) · Prisma · Python FastAPI + Prophet · French / English / Arabic

<!-- Add 2–3 screenshots here: dashboard, POS screen, forecast chart.
     Example: ![POS screen](docs/screenshots/pos.png) -->

---

## The problem

Small and mid-size retailers in Algeria often run on paper, Excel or single-store tools. They can't see stock across stores, they over-order slow products and run out of fast ones before Ramadan and Eid, and their invoices have to follow local legal requirements.

## What RetailOS does

| Area | Features |
| --- | --- |
| **Point of sale** | Fast checkout, cash sessions, returns, barcodes, offline sync |
| **Inventory** | Multi-store and multi-warehouse stock, transfers, stock counts, batch expiry tracking |
| **Purchasing** | Purchase orders, deliveries and receiving, purchase returns, supplier quotes and catalog |
| **Invoicing** | PDF invoices following Algerian invoicing rules (Décret 05-468), payments, customer debts |
| **Finance** | Expenses, financial periods, profit & loss, advanced financial reports, scheduled report exports |
| **People** | Roles and permissions, employees, attendance, work schedules, sales commissions |
| **Customers** | Customer accounts, loyalty, customer-specific pricing |
| **Intelligence** | Demand forecasting, reorder recommendations, supplier ranking, waste prediction, what-if scenarios |

## The analytics and optimization behind it

This is where the project goes beyond a standard CRUD app:

- **Demand forecasting with local seasonality.** A separate Python service fits a Prophet model per product, with a custom **Algerian event calendar**: pre-Ramadan stocking-up, Ramadan, Eid al-Fitr, Eid al-Adha and back-to-school, each with its own before/after window. Forecasts are clipped at zero because demand can't be negative.
- **Inventory optimization.** Economic Order Quantity (EOQ) and safety stock / reorder point from 90 days of sales history, with a configurable service level (90 / 95 / 99 %).
- **Supplier ranking with multi-criteria decision analysis.** AHP criteria weights combined with TOPSIS or PROMETHEE ranking over six criteria: price, quality, delivery time, reliability, payment terms and product range, each treated as a cost or a benefit.
- **Waste prediction.** Flags batches likely to expire before they sell, by comparing days to expiry with recent sales velocity.
- **Scenario simulation.** "What happens to profit if prices rise 10 % and demand drops 5 %?", computed from the real P&L.

## Architecture

```
Browser (FR/EN/AR, right-to-left layout for Arabic)
        │
Next.js 16 App Router ── API routes ── service layer (50+ services)
        │                     │
        │               Prisma 6 ── PostgreSQL 16 with row-level security per tenant
        │                     │
        │               BullMQ / Redis (background jobs, scheduled reports)
        │               Socket.io (real-time updates)
        │               MinIO (files)
        │
Python FastAPI "ai-engine" ── Prophet forecasting + Algerian event calendar
```

- **Multi-tenant by design:** every tenant's data is isolated at the database level with PostgreSQL row-level security, not only in application code. An integration test checks that one tenant can't read another's rows.
- **Desktop edition:** a Tauri package bundles the app with a local PostgreSQL for shops with unreliable internet.

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) and [DATABASE.md](DATABASE.md) (63 data models).

## Run it locally

Requirements: Docker, Node.js 22+, pnpm.

```bash
docker compose up -d
npx prisma migrate deploy   # or: docker compose exec app npx prisma migrate deploy
npx prisma db seed          # or: docker compose exec app npx prisma db seed
```

Open `http://localhost:3000`. Demo accounts: `admin@tenant-a.demo` / `Demo1234!` (and `tenant-b`).

Other commands:

```bash
pnpm dev          # Next.js dev server
pnpm worker       # background job worker
pnpm realtime     # Socket.io server
pnpm lint && pnpm typecheck && pnpm test
```

## Documentation

- [User guide](docs/user-guide.md): create an account, add a store and products, make a sale, read the reports (French).
- [Admin guide](docs/admin-guide.md): production deployment, backups, environment variables, troubleshooting (French).
- [Roadmap](ROADMAP.md): development phases.

## Tech stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui · Prisma 6, PostgreSQL 16, NextAuth v5 · BullMQ, Redis, Socket.io, MinIO · Python, FastAPI, Prophet, pandas · Tauri (desktop) · Docker, GitHub Actions CI

## Author

**Abdelmoumen Houma**: data analyst and developer, Master's in Operations Research.
I build analytics, forecasting and optimization into real business software.
[LinkedIn](https://linkedin.com/in/abdelmoumen-houma-806405399) · [GitHub](https://github.com/moumenhouma) <!-- add your Upwork profile link -->

## License

Proprietary. Source shown for portfolio purposes; not licensed for commercial use.
