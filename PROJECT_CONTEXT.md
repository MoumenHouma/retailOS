# RetailOS — Project Context

> **Version:** 1.0 | **Date:** 2026-07-07
> **Document Type:** Business Requirements & Domain Context
> **Audience:** AI coding assistants, developers, product stakeholders

---

## 1. Project Overview

**RetailOS** is a multi-tenant SaaS platform designed to be the **Retail Operating System** for Algeria. It combines Enterprise Resource Planning (ERP), Artificial Intelligence (AI), Business Intelligence (BI), and Decision Support Systems (DSS) into a single cloud platform.

The first vertical is **supermarket management**. The architecture is designed to be extensible to other retail verticals (pharmacies, hardware stores, electronics shops, wholesalers, clothing stores, bookstores) with minimal changes.

The core differentiator is not basic transaction recording — every competitor does that. RetailOS transforms operational data into **actionable business recommendations** using the founder's specialization in Modélisation, Optimisation et Aide à la Décision (MOAD).

---

## 2. Vision Statement

> Build an AI-powered Retail Decision Platform. The POS, inventory, purchasing, finance, and CRM modules become the data collection layer. The true competitive advantage is the optimization engine that transforms operational data into recommendations: optimal purchase quantities, supplier rankings using AHP/TOPSIS/PROMETHEE, demand forecasting, dynamic pricing, waste reduction, staff scheduling, and scenario simulation.

RetailOS does not just digitize operations. It **augments managerial intelligence**.

---

## 3. Market Analysis — Algerian Retail Sector

### 3.1 Current State

The Algerian retail sector has experienced significant growth during the last decade. Supermarkets, minimarkets, wholesalers, and neighborhood grocery stores increasingly require digital tools. However, a considerable proportion of retailers continue to rely on:

- **Desktop software** (often pirated, single-user, no cloud sync)
- **Spreadsheets** (Excel) for inventory and purchasing
- **Manual processes** (paper-based stock counting, handwritten invoices)
- **Aging Windows POS solutions** (no updates, no integration, no analytics)

### 3.2 Key Market Observations

- Most stores still rely on desktop software, Excel, or aging Windows POS solutions.
- **Offline capability is a competitive advantage** because internet connectivity is not always reliable outside major cities.
- Compliance with Algerian invoicing requirements (NIF, NIS, RC, AI, TVA, sequential numbering) is essential and legally mandated.
- Native support for **DZD** (Algerian Dinar) and **French/Arabic** languages is expected by users.
- Very few local ERPs combine operations research, forecasting, and decision support — this is the area where the MOAD specialization creates a defensible competitive moat.

### 3.3 Competitive Landscape

| Competitor | Strengths | Weaknesses |
|---|---|---|
| eFawtara | Invoice compliance, simple UI | Invoice-only, no full ERP |
| QuickBooks | Global brand, accounting focus | Not adapted to Algerian law, no POS |
| Local desktop POS | Cheap, known | No cloud, no updates, no AI, single-user |
| SAP/Oracle | Enterprise-grade | Prohibitively expensive for Algerian SMBs |
| Odoo | Modular, open-source | Complex setup, no Algerian compliance out-of-the-box |

**RetailOS's advantage:** Purpose-built for Algeria with legal compliance, AI/optimization, and an accessible price point for SMBs.

---

## 4. Problem Statement

Most retail management systems currently available focus primarily on recording business transactions. While they provide essential operational functionality, they rarely assist managers in making informed strategic decisions.

Existing systems generally do not answer questions such as:

- Which products should be reordered today?
- Which supplier provides the best overall value (considering price, delivery time, reliability, quality)?
- Which products are likely to expire this week?
- How much inventory should be purchased before Ramadan?
- Which promotion will maximize profit without eroding margins?
- Which employee schedule minimizes labor costs while maintaining service quality?
- What will happen to profitability if prices increase by 5%?
- Which shelf placement maximizes cross-selling?

Managers are required to make these decisions manually, relying on experience rather than analytical evidence. RetailOS proposes an integrated Decision Support System that transforms operational data into actionable business recommendations.

---

## 5. Project Objectives

### 5.1 General Objective

Develop an enterprise-grade cloud platform capable of managing all operational aspects of retail businesses while integrating optimization, forecasting, artificial intelligence, and decision support.

### 5.2 Specific Objectives

The system shall:

1. **Product Management** — Create, categorize, barcode, and manage product catalogs with full traceability.
2. **Inventory Management** — Track stock levels in real-time, manage stock movements, prevent shortages and overstocking.
3. **Warehouse Management** — Organize storage locations, manage transfers between warehouses/stores.
4. **Supplier Management** — Maintain supplier records, evaluate performance, rank using MCDA methods.
5. **Purchasing** — Generate purchase orders, track deliveries, optimize reorder quantities.
6. **Customer Management** — Track customer data, purchasing history, loyalty points.
7. **Employee Management** — Manage staff, roles, schedules, attendance, and commissions.
8. **Financial Management** — Invoicing (DÉCRET 05-468 compliant), expense tracking, tax reporting, profit/loss.
9. **Point of Sale** — Fast, reliable, offline-capable POS for daily sales operations.
10. **Business Intelligence** — Dashboards, reports, KPIs, and visual analytics.
11. **Demand Forecasting** — Predict future sales using historical data, seasonality, and external factors (Ramadan, holidays).
12. **Inventory Optimization** — Calculate optimal reorder points, safety stock, and economic order quantities.
13. **Waste Reduction** — Predict expirations, recommend markdowns, track waste metrics.
14. **Supplier Ranking** — Multi-criteria evaluation using AHP, TOPSIS, PROMETHEE methods.
15. **Scenario Simulation** — Model "what-if" scenarios (price changes, demand shifts, supplier changes).
16. **Algerian Compliance** — Full compliance with NIF, NIS, RC, AI, TVA requirements and invoice regulations.

---

## 6. Stakeholders

### 6.1 Platform Administrator
Responsible for platform maintenance, billing, tenant management, monitoring, and technical administration. This role operates across all tenants and manages the SaaS infrastructure itself.

### 6.2 Business Owner
Owns one or more retail stores. Responsible for strategic decisions, financial monitoring, and organizational management. Has full access to all modules within their tenant. Can view all reports, AI recommendations, and simulation results.

### 6.3 Store Manager
Responsible for supervising day-to-day operations. Monitors inventory, purchasing, employees, and performance indicators. Can create purchase orders, manage transfers, and approve returns. Does not have access to platform-level settings or other tenants' data.

### 6.4 Cashier
Processes customer sales through the Point-of-Sale system. Needs a fast, intuitive interface optimized for speed. Can apply discounts (within authorized limits), process returns, and handle multiple payment methods (cash, card, check).

### 6.5 Inventory Employee
Responsible for receiving products, stock adjustments, inventory counting, transfers between locations, and warehouse organization. Works with barcode scanners and mobile devices.

### 6.6 Accountant
Uses financial reports, invoices, tax calculations, and accounting exports. Needs accurate, compliant invoicing and the ability to export data for official tax filings.

### 6.7 Supplier (Future)
Future portal allowing suppliers to receive purchase orders, confirm availability, update delivery status, and view payment history.

### 6.8 Customer (Future)
Future loyalty application allowing customers to view loyalty points, active promotions, purchase history, and receive personalized offers.

---

## 7. Scope

### 7.1 Version 1.0 — Included

| Module | Description |
|---|---|
| Authentication | Secure login, logout, password reset, session management, MFA-ready |
| Multi-tenant Architecture | Row-Level Security, tenant isolation, tenant settings |
| Product Management | Catalog, categories, brands, barcodes, units, variants, pricing tiers |
| Inventory Management | Stock tracking, movements, adjustments, counting, transfers, alerts |
| Warehouse Management | Locations, zones, shelves, bin management, transfer optimization |
| Point of Sale | Fast checkout, cart, discounts, holds, multiple payments, offline mode |
| Purchasing | Purchase orders, supplier quotes, delivery tracking, auto-reorder suggestions |
| Supplier Management | Supplier directory, evaluation, ranking, communication history |
| Customer Management | Customer records, loyalty points, purchase history, segments |
| Financial Management | Invoicing (compliant), expenses, taxes (TVA), profit/loss, balance sheet |
| Employee Management | Staff records, roles, schedules, attendance, commissions |
| Dashboards | KPI overview, sales trends, inventory health, financial snapshots |
| Reporting | Sales reports, inventory reports, purchase reports, financial reports, export |
| AI & Decision Support | Demand forecasting, supplier ranking, inventory optimization, waste prediction |
| Optimization Engine | AHP, TOPSIS, PROMETHEE for supplier evaluation and purchase decisions |

### 7.2 Future Versions

| Module | Description |
|---|---|
| Mobile Applications | Native iOS/Android apps for cashiers and managers |
| E-commerce | Online store integration |
| Marketplace | Multi-vendor marketplace platform |
| Delivery Optimization | Route planning, delivery tracking |
| IoT Integration | Electronic scales (CAS, Digi, Bizerba), electronic shelf labels, RFID |
| Computer Vision | Shelf monitoring, product recognition, stock counting via camera |
| Voice Assistant | Natural language queries (French, Arabic, English) for decision support |
| Store Layout Optimization | AI-recommended shelf allocation, customer flow, product positioning |
| Queue Optimization | Predict cashier wait times, optimize staffing |

### 7.3 Explicitly Out of Scope (V1)

- Hardware manufacturing or sales
- Payment gateway integration (beyond basic cash/card recording)
- Government tax filing API integration (manual export only for V1)
- Multi-currency support (DZD only for V1)
- Biometric authentication
- Blockchain/smart contracts

---

## 8. Functional Requirements Summary

### 8.1 Authentication & Authorization
- Secure login with email/password
- Secure logout
- Password reset with email verification
- Session management (JWT + httpOnly cookies)
- Role-Based Access Control (RBAC) with granular permissions
- Multi-store access control (a user may access multiple stores within a tenant)
- Audit logging for all authentication events

### 8.2 Product Management
- Full CRUD for products (name, description, category, brand, barcode, unit, image)
- Product variants (size, color, weight)
- Product categories (hierarchical tree structure)
- Brand management
- Unit of measure management (piece, kg, liter, box, pack)
- Pricing: cost price, selling price, wholesale price
- Barcode generation (EAN-13, Code-128)
- Batch/lot management with expiration tracking
- Product search (by name, barcode, category, brand)
- Import products from CSV/Excel
- Export product catalog

### 8.3 Inventory Management
- Real-time stock level tracking per product per location
- Stock movements: IN (purchase, return, transfer), OUT (sale, write-off, transfer), ADJUSTMENT
- Minimum stock level alerts (configurable per product)
- Maximum stock level warnings
- Expiration date tracking with automatic alerts
- Stock counting (full and partial inventory counts)
- Stock adjustments with reason tracking
- Stock transfers between warehouses and stores
- Stock valuation (FIFO, weighted average)
- Inventory reports (current stock, movement history, aging)

### 8.4 Point of Sale
- Fast product lookup (barcode scan, name search, category browse)
- Shopping cart management (add, remove, quantity, discount)
- Per-line and per-ticket discounts
- Multiple payment methods per transaction (cash, card, check, mixed)
- Hold/recall transactions
- Returns and refunds
- Receipt printing (thermal printer format)
- Invoice generation (when customer requests facture)
- Cash drawer management (open, close, audit)
- End-of-day Z-report (X/Z reports)
- Offline mode (queue transactions, sync when online)
- Keyboard shortcuts for rapid operation

### 8.5 Purchasing
- Purchase order creation (from scratch or from AI suggestions)
- Supplier quotation comparison
- Purchase order approval workflow
- Partial and full delivery receipt
- Purchase return management
- Automatic reorder point triggers
- Delivery tracking and expected dates
- Purchase history and analytics

### 8.6 Supplier Management
- Supplier directory (name, contact, NIF, address, bank details)
- Supplier evaluation (price, quality, delivery time, reliability)
- MCDA-based supplier ranking (AHP, TOPSIS, PROMETHEE)
- Supplier communication history
- Supplier product catalog mapping
- Supplier performance dashboard

### 8.7 Financial Management
- Invoice generation compliant with DÉCRET 05-468 (all 12+ mandatory fields)
- Sequential invoice numbering per tenant (no gaps, database-enforced)
- TVA calculation (19% standard, 9% reduced, 0% exempt)
- Tax stamp (droit de timbre) calculation: 1% of TTC, minimum 100 DZD
- Expense tracking and categorization
- Accounts receivable and accounts payable
- Profit & loss reporting
- Balance sheet (simplified)
- Cash flow tracking
- Tax report generation (TVA declaration support data)
- Payment tracking (paid, partial, overdue)
- Financial period management
- Export to accounting software formats

### 8.8 Customer Management (CRM)
- Customer record creation (name, phone, email, address, NIF)
- Loyalty points system (earn and redeem)
- Purchase history
- Customer segmentation (by spending, frequency, category)
- Debt tracking (for credit customers)
- Customer-specific pricing

### 8.9 Employee Management
- Employee records (name, role, contract, salary)
- Role and permission management (RBAC)
- Work schedule management
- Attendance tracking
- Sales commission calculation (per product, per category, per shift)
- Performance metrics

### 8.10 Reports & BI
- Sales reports (daily, weekly, monthly, yearly, custom range)
- Inventory reports (stock levels, movements, aging, valuation)
- Purchase reports (by supplier, by category, by period)
- Financial reports (revenue, expenses, profit, taxes)
- Employee performance reports
- Customer analytics (top customers, segmentation, retention)
- Export to PDF, Excel, CSV
- Scheduled report generation (email delivery)
- Dashboard widgets (configurable per role)

### 8.11 AI & Decision Support
- **Demand Forecasting:** Predict future sales per product using historical data, seasonality, and events (Ramadan, Eid, school year).
- **Supplier Ranking:** Evaluate and rank suppliers using Multi-Criteria Decision Analysis (MCDA) methods: AHP for weight determination, TOPSIS and PROMETHEE for ranking.
- **Inventory Optimization:** Calculate optimal reorder points, economic order quantities (EOQ), and safety stock levels.
- **Waste Prediction:** Predict which products will expire before sale and recommend markdowns or transfers.
- **Purchase Recommendations:** Suggest what to order, from whom, and in what quantity based on forecasted demand, current stock, and supplier scores.
- **Scenario Simulation:** Model "what-if" scenarios (price changes, demand shifts, cost variations) and predict impact on profitability.

---

## 9. Non-Functional Requirements

### 9.1 Performance
- Average page load time: < 2 seconds (P95)
- POS transaction processing: < 500ms
- API response time: < 300ms for read operations, < 1s for write operations
- Dashboard data loading: < 3 seconds

### 9.2 Scalability
- Multi-tenant architecture supporting thousands of businesses
- Database must handle 100M+ rows efficiently
- Must support horizontal scaling of API servers
- Static assets served via CDN

### 9.3 Availability
- Target: 99.9% uptime
- POS must function offline (queue & sync)
- Graceful degradation when AI services are unavailable

### 9.4 Security
- Row-Level Security (RLS) for tenant isolation
- AES-256 encryption for sensitive data at rest
- TLS 1.3 for data in transit
- Secure authentication with bcrypt (cost factor 12+)
- RBAC with granular permissions
- Comprehensive audit logging (who did what, when, from where)
- Rate limiting on all API endpoints
- CSRF protection
- SQL injection prevention (parameterized queries via Prisma)
- XSS prevention (React default + CSP headers)

### 9.5 Maintainability
- Modular architecture (clear separation of concerns)
- Clean code principles (SOLID, DRY)
- Comprehensive TypeScript types (strict mode)
- Automated testing (unit, integration, e2e)
- Code documentation (JSDoc, README per module)
- Consistent coding conventions (enforced by ESLint, Prettier)

### 9.6 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Sufficient color contrast
- Arabic RTL layout support

### 9.7 Localization
- French (primary interface language for Algeria)
- Arabic (full RTL support)
- English (secondary)
- DZD currency formatting: `1 250,00 DA`
- Date formatting: `DD/MM/YYYY`

### 9.8 Reliability
- Database transactions for all multi-step operations
- Idempotent API operations where applicable
- Proper error handling and recovery
- Data backup and disaster recovery procedures

### 9.9 Usability
- Mobile-responsive design (minimum 320px viewport)
- Intuitive navigation (consistent across modules)
- Contextual help and tooltips
- Fast, keyboard-driven POS interface
- Bulk actions on all list pages
- Import/Export capabilities on all data-heavy pages

---

## 10. Algerian Legal & Fiscal Context

### 10.1 Business Identification

Every Algerian business must have the following identifiers, all of which must be stored and displayed on invoices:

| Identifier | Full Name | Description |
|---|---|---|
| **NIF** | Numero d'Identification Fiscale | 15-character alphanumeric tax ID issued by DGI (Direction Générale des Impôts) |
| **NIS** | Numero d'Identification Statistique | Statistical ID issued by ONS (Office National des Statistiques) |
| **RC** | Registre de Commerce | Commercial registration number issued by CNRC |
| **AI** | Article d'Imposition | Tax article number |
| **Forme Juridique** | Legal Form | SARL, SPA, EURL, EIRL, SNC, etc. |

### 10.2 Taxation

- **TVA (VAT):** Standard rate 19%, reduced rate 9% (for some food products and essentials), 0% for exempt categories.
- **Tax Stamp (Droit de Timbre):** 1% of the invoice total including TVA (TTC). Minimum amount: 100 DZD.
- **Legal archive period:** 10 years for invoices and financial documents.

### 10.3 Invoice Requirements (DÉCRET EXÉCUTIF 05-468)

Every invoice must contain the following mandatory fields:

1. Sequential invoice number (no gaps allowed)
2. Date and place of issue
3. Seller's identification: NIF, NIS, RC, AI, legal name, address
4. Buyer's identification: name, address, NIF (if applicable)
5. Description of goods/services
6. Quantity
7. Unit price (in DZD)
8. Total amount before tax (HT)
9. TVA rate(s) applied and corresponding amount(s)
10. Tax stamp amount
11. Total amount including tax (TTC)
12. Payment terms and conditions

### 10.4 Currency

- **Algerian Dinar (DZD)** — the only legal tender for domestic transactions.
- Display format: `1 250,00 DA` (space as thousands separator, comma as decimal separator).
- No cents/denomination below 1 DZD in practice, but calculations should maintain precision to avoid rounding errors in large volumes.
- Store all monetary values as integers in the smallest practical unit (centimes, 1 DZD = 100 centimes).