# RetailOS — Database Design

> **Version:** 1.0 | **Date:** 2026-07-07
> **Document Type:** Database Schema Specification
> **Audience:** AI coding assistants, developers, database administrators
> **Engine:** PostgreSQL 16+ | **ORM:** Prisma 6.x

---

## 1. Design Principles

1. **Every business table** has `tenant_id` (UUID, NOT NULL, indexed) — enforced by RLS policies.
2. **Primary keys** are UUID v4 (`id` column, default `uuid_generate_v4()`).
3. **Timestamps** are mandatory: `created_at` (timestamptz, default `now()`), `updated_at` (timestamptz, auto-update), `deleted_at` (timestamptz, nullable, for soft delete).
4. **Audit trail**: `created_by` and `updated_by` (UUID, nullable, references `users.id`).
5. **Monetary values** are stored as `Int` in **centimes** (1 DZD = 100 centimes). Example: 150,50 DA → `15050`.
6. **Soft delete**: Never physically delete rows. Set `deleted_at IS NOT NULL` instead. All queries include `WHERE deleted_at IS NULL` (enforced by RLS or views).
7. **RLS**: Every business table has Row-Level Security policies filtering on `tenant_id` from the session variable `app.current_tenant_id`.
8. **Constraints**: Use CHECK, UNIQUE, and FOREIGN KEY constraints aggressively at the database level.
9. **Indexes**: Create indexes on all foreign keys, frequently queried columns, and columns used in WHERE/ORDER BY.
10. **Enums**: Use PostgreSQL ENUM types for fixed value sets. Prefer `VARCHAR` + CHECK for sets that may expand.

---

## 2. Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- For trigram text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- For GIN indexes on multiple columns
```

---

## 3. RLS Setup

```sql
-- Create a custom GUC for tenant isolation
DO $$
BEGIN
  ALTER DATABASE current_database() SET app.current_tenant_id = '';
END
$$;

-- Function to check tenant access
CREATE OR REPLACE FUNCTION app.check_tenant_id()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (current_setting('app.current_tenant_id', TRUE) IS NOT NULL
          AND app.check_tenant_id_table());
END;
$$ LANGUAGE sql STABLE;

-- Enable RLS on all business tables (template)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON products
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

---

## 4. System Tables (No tenant_id)

These tables exist at the platform level, outside any tenant.

### 4.1 tenants

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, default uuid_generate_v4() | Tenant ID |
| name | VARCHAR(255) | NOT NULL | Business name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly identifier |
| logo_url | VARCHAR(500) | | Logo file URL |
| nif | VARCHAR(20) | NOT NULL | Numéro d'Identification Fiscale (15 chars) |
| nis | VARCHAR(20) | NOT NULL | Numéro d'Identification Statistique |
| rc | VARCHAR(30) | NOT NULL | Registre de Commerce |
| ai | VARCHAR(30) | | Article d'Imposition |
| forme_juridique | VARCHAR(50) | | Legal form (SARL, SPA, EURL, etc.) |
| address | TEXT | | Full business address |
| city | VARCHAR(100) | | City |
| wilaya | VARCHAR(100) | | Province/Wilaya |
| phone | VARCHAR(20) | | Phone number |
| email | VARCHAR(255) | | Business email |
| website | VARCHAR(500) | | Website URL |
| activity_sector | VARCHAR(100) | | NAE/CNRC activity code |
| tva_default_rate | SMALLINT | DEFAULT 19 | Default TVA rate (basis points: 19 = 19%) |
| currency | VARCHAR(3) | DEFAULT 'DZD' | ISO 4217 currency code |
| locale | VARCHAR(5) | DEFAULT 'fr-DZ' | Default locale |
| subscription_plan | VARCHAR(50) | DEFAULT 'starter' | SaaS plan |
| subscription_status | subscription_status_enum | DEFAULT 'active' | active, trial, suspended, cancelled |
| subscription_ends_at | TIMESTAMPTZ | | Subscription end date |
| settings | JSONB | DEFAULT '{}' | Tenant-wide settings (JSON) |
| is_active | BOOLEAN | DEFAULT true | Whether tenant is active |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Auto-updated via trigger |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes:** `slug` (UNIQUE), `nif` (UNIQUE), `email`

**Check Constraints:**
- `CHECK (nif ~ '^[A-Za-z0-9]{15}$')` — NIF is exactly 15 alphanumeric characters
- `CHECK (tva_default_rate IN (0, 9, 19))`

### 4.2 stores

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | Store ID |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| name | VARCHAR(255) | NOT NULL | Store name |
| address | TEXT | | Store address |
| city | VARCHAR(100) | | City |
| wilaya | VARCHAR(100) | | Province/Wilaya |
| phone | VARCHAR(20) | | Store phone |
| email | VARCHAR(255) | | Store email |
| is_main | BOOLEAN | DEFAULT false | Main store of the tenant |
| pos_prefix | VARCHAR(5) | DEFAULT 'POS' | Prefix for POS terminal names |
| settings | JSONB | DEFAULT '{}' | Store-specific settings |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** `tenant_id`, `(tenant_id, is_main)`

**Check:** `CHECK (deleted_at IS NULL OR is_active = false)`

### 4.3 users

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | User ID |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| first_name | VARCHAR(100) | NOT NULL | |
| last_name | VARCHAR(100) | NOT NULL | |
| phone | VARCHAR(20) | | |
| avatar_url | VARCHAR(500) | | |
| is_active | BOOLEAN | DEFAULT true | |
| email_verified_at | TIMESTAMPTZ | | When email was verified |
| last_login_at | TIMESTAMPTZ | | |
| failed_login_attempts | INT | DEFAULT 0 | For lockout |
| locked_until | TIMESTAMPTZ | | Lockout end time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** `email` (UNIQUE), `tenant_id`

### 4.4 roles

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | FK → tenants.id, NOT NULL | |
| name | VARCHAR(50) | NOT NULL | e.g., BUSINESS_OWNER, STORE_MANAGER, CASHIER |
| description | TEXT | | |
| is_system | BOOLEAN | DEFAULT false | System roles cannot be deleted |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique:** `(tenant_id, name)`

### 4.5 permissions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| name | VARCHAR(100) | UNIQUE, NOT NULL | e.g., products:read, pos:operate |
| description | TEXT | | |
| module | VARCHAR(50) | NOT NULL | Module name (products, inventory, pos, etc.) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Indexes:** `module`

### 4.6 role_permissions (junction)

| Column | Type | Constraints |
|---|---|---|
| role_id | UUID | FK → roles.id, PK part |
| permission_id | UUID | FK → permissions.id, PK part |

### 4.7 user_roles (junction)

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | FK → users.id, PK part |
| role_id | UUID | FK → roles.id, PK part |
| store_id | UUID | FK → stores.id | If null, role applies to all stores in tenant |

### 4.8 user_stores (junction)

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | FK → users.id, PK part |
| store_id | UUID | FK → stores.id, PK part |

---

## 5. Product Management Tables

### 5.1 product_categories

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL, indexed | |
| parent_id | UUID | FK → product_categories.id, nullable | Self-referencing for hierarchy |
| name | VARCHAR(255) | NOT NULL | Category name (French) |
| name_ar | VARCHAR(255) | | Arabic name |
| name_en | VARCHAR(255) | | English name |
| description | TEXT | | |
| image_url | VARCHAR(500) | | |
| sort_order | INT | DEFAULT 0 | Display order |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** `tenant_id`, `parent_id`, `(tenant_id, name)` UNIQUE WHERE deleted_at IS NULL

### 5.2 brands

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| country | VARCHAR(100) | | Country of origin |
| description | TEXT | | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Unique:** `(tenant_id, name)` WHERE deleted_at IS NULL

### 5.3 units

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| name | VARCHAR(50) | NOT NULL | Display name: "pièce", "kg", "litre", "boîte", "paquet" |
| abbreviation | VARCHAR(10) | NOT NULL | "pcs", "kg", "L", "box", "pkg" |
| is_base_unit | BOOLEAN | DEFAULT false | Base unit for stock counting |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

### 5.4 products

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL, indexed | |
| sku | VARCHAR(50) | | Internal stock keeping unit |
| name | VARCHAR(500) | NOT NULL | Product name (French) |
| name_ar | VARCHAR(500) | | Arabic name |
| name_en | VARCHAR(500) | | English name |
| description | TEXT | | |
| category_id | UUID | FK → product_categories.id | |
| brand_id | UUID | FK → brands.id | |
| unit_id | UUID | FK → units.id, NOT NULL | Base unit of measure |
| barcode | VARCHAR(20) | | Primary barcode (EAN-13) |
| cost_price | INT | | Cost price in centimes |
| selling_price | INT | NOT NULL | Selling price in centimes |
| wholesale_price | INT | | Wholesale price in centimes |
| min_price | INT | | Minimum allowed selling price |
| tva_rate | SMALLINT | DEFAULT 19 | TVA rate in basis points (19 = 19%) |
| is_taxable | BOOLEAN | DEFAULT true | Whether TVA applies |
| is_trackable | BOOLEAN | DEFAULT true | Track stock movements |
| is_expirable | BOOLEAN | DEFAULT false | Whether the product has expiration dates |
| shelf_life_days | INT | | Default shelf life in days (for expirable products) |
| min_stock_level | INT | DEFAULT 0 | Alert threshold |
| max_stock_level | INT | | Overstock warning threshold |
| reorder_point | INT | | Calculated by AI (EOQ model) |
| safety_stock | INT | | Calculated by AI |
| image_url | VARCHAR(500) | | Main product image |
| is_active | BOOLEAN | DEFAULT true | |
| created_by | UUID | FK → users.id | |
| updated_by | UUID | FK → users.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** `tenant_id`, `barcode`, `sku`, `category_id`, `brand_id`, `name` (pg_trgm gin index for search)

**Check:**
- `CHECK (selling_price >= 0)`
- `CHECK (cost_price >= 0)`
- `CHECK (tva_rate IN (0, 9, 19))`

### 5.5 product_barcodes

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| product_id | UUID | FK → products.id, NOT NULL | |
| barcode | VARCHAR(20) | NOT NULL | |
| barcode_type | VARCHAR(20) | DEFAULT 'EAN13' | EAN13, CODE128, QR, INTERNAL |
| is_primary | BOOLEAN | DEFAULT false | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique:** `(tenant_id, barcode)` WHERE deleted_at IS NULL

### 5.6 product_batches

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| product_id | UUID | FK → products.id, NOT NULL | |
| batch_number | VARCHAR(100) | NOT NULL | Supplier batch/lot number |
| manufacturing_date | DATE | | |
| expiration_date | DATE | | |
| quantity_received | INT | NOT NULL | Initial quantity in this batch |
| quantity_remaining | INT | NOT NULL | Current remaining quantity |
| unit_cost | INT | | Cost per unit in centimes |
| supplier_id | UUID | FK → suppliers.id | |
| store_id | UUID | FK → stores.id | |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Check:** `CHECK (quantity_remaining >= 0)`

---

## 6. Inventory Tables

### 6.1 stock_movements (immutable log)

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL, indexed | |
| product_id | UUID | FK → products.id, NOT NULL | |
| store_id | UUID | FK → stores.id, NOT NULL | Location |
| movement_type | stock_movement_type_enum | NOT NULL | See enum below |
| quantity | INT | NOT NULL | Positive value (direction in enum) |
| reference_id | UUID | | FK to sale, purchase_order, transfer, etc. |
| reference_type | VARCHAR(50) | | 'sale', 'purchase_order', 'stock_transfer', 'adjustment' |
| batch_id | UUID | FK → product_batches.id | |
| notes | TEXT | | Reason for adjustment |
| created_by | UUID | FK → users.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Enum: stock_movement_type_enum**
```
PURCHASE_IN       -- Stock in from purchase
SALE_OUT          -- Stock out from sale
TRANSFER_OUT      -- Stock out for transfer
TRANSFER_IN       -- Stock in from transfer
ADJUSTMENT_IN     -- Manual stock increase
ADJUSTMENT_OUT    -- Manual stock decrease
RETURN_IN         -- Customer return
RETURN_OUT        -- Return to supplier
WRITE_OFF         -- Expired/damaged removal
```

**Indexes:** `tenant_id`, `product_id`, `store_id`, `movement_type`, `created_at`, `(product_id, store_id, created_at)`

### 6.2 stock_levels (denormalized, trigger-maintained)

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| product_id | UUID | FK → products.id, NOT NULL | |
| store_id | UUID | FK → stores.id, NOT NULL | |
| quantity_on_hand | INT | NOT NULL, DEFAULT 0 | Current available quantity |
| quantity_reserved | INT | NOT NULL, DEFAULT 0 | Reserved (e.g., held orders) |
| quantity_available | INT | GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED | Available for sale |
| last_movement_at | TIMESTAMPTZ | | Timestamp of last stock change |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique:** `(tenant_id, product_id, store_id)` — one stock level per product per location.

**Trigger:** After INSERT on `stock_movements`, update the corresponding `stock_levels` row:
- For IN movements: `quantity_on_hand += quantity`
- For OUT movements: `quantity_on_hand -= quantity` (reject if result < 0)

### 6.3 stock_transfers

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| transfer_number | VARCHAR(50) | NOT NULL | Sequential transfer number |
| from_store_id | UUID | FK → stores.id, NOT NULL | Source location |
| to_store_id | UUID | FK → stores.id, NOT NULL | Destination location |
| status | transfer_status_enum | DEFAULT 'draft' | draft, pending, in_transit, received, cancelled |
| notes | TEXT | | |
| created_by | UUID | FK → users.id | |
| approved_by | UUID | FK → users.id | |
| received_by | UUID | FK → users.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

### 6.4 stock_transfer_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| transfer_id | UUID | FK → stock_transfers.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| quantity_requested | INT | NOT NULL |
| quantity_sent | INT | DEFAULT 0 |
| quantity_received | INT | DEFAULT 0 |
| notes | TEXT | |

### 6.5 stock_counts (inventory counting sessions)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| store_id | UUID | FK → stores.id, NOT NULL |
| count_number | VARCHAR(50) | NOT NULL |
| status | count_status_enum | DEFAULT 'in_progress' |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| completed_at | TIMESTAMPTZ | |
| notes | TEXT | |
| created_by | UUID | FK → users.id |
| approved_by | UUID | FK → users.id |

### 6.6 stock_count_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| count_id | UUID | FK → stock_counts.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| system_quantity | INT | NOT NULL | Current system stock |
| counted_quantity | INT | NOT NULL | What was physically counted |
| difference | INT | GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED |
| adjustment_status | adjustment_status_enum | DEFAULT 'pending' |

---

## 7. POS & Sales Tables

### 7.1 sales

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL, indexed | |
| store_id | UUID | FK → stores.id, NOT NULL | |
| sale_number | VARCHAR(50) | NOT NULL | Sequential sale number per store |
| pos_session_id | UUID | FK → pos_sessions.id | |
| customer_id | UUID | FK → customers.id | |
| cashier_id | UUID | FK → users.id, NOT NULL | |
| subtotal | INT | NOT NULL | Total before discounts and tax (centimes) |
| discount_amount | INT | DEFAULT 0 | Total discount (centimes) |
| tva_amount | INT | NOT NULL | Total TVA (centimes) |
| tax_stamp_amount | INT | NOT NULL | Droit de timbre (centimes) |
| total | INT | NOT NULL | Grand total = subtotal - discount + tva + tax_stamp |
| total_paid | INT | NOT NULL | Amount actually paid |
| change_due | INT | NOT NULL | Change to return to customer |
| status | sale_status_enum | DEFAULT 'completed' | completed, voided, held |
| is_offline | BOOLEAN | DEFAULT false | Whether sale was made offline |
| synced_at | TIMESTAMPTZ | | When offline sale was synced |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

**Indexes:** `tenant_id`, `store_id`, `sale_number`, `cashier_id`, `created_at`

### 7.2 sale_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| sale_id | UUID | FK → sales.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| product_name | VARCHAR(500) | NOT NULL | Snapshot of product name at time of sale |
| product_barcode | VARCHAR(20) | | Snapshot of barcode |
| quantity | INT | NOT NULL |
| unit_price | INT | NOT NULL | Selling price at time of sale (centimes) |
| cost_price | INT | | Cost price at time of sale (for margin calculation) |
| tva_rate | SMALLINT | NOT NULL |
| discount_amount | INT | DEFAULT 0 | Per-line discount (centimes) |
| subtotal | INT | NOT NULL | quantity * unit_price - discount |
| tva_amount | INT | NOT NULL | subtotal * tva_rate / 100 |
| total | INT | NOT NULL | subtotal + tva_amount |
| batch_id | UUID | FK → product_batches.id | For FIFO/FEFO tracking |

**Indexes:** `tenant_id`, `sale_id`, `product_id`

### 7.3 sale_payments

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| sale_id | UUID | FK → sales.id, NOT NULL |
| payment_method | payment_method_enum | NOT NULL |
| amount | INT | NOT NULL |
| reference | VARCHAR(100) | Card number (last 4), check number, etc. |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Enum: payment_method_enum:** CASH, CARD, CHECK, TRANSFER, MIXED

### 7.4 sale_returns

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| store_id | UUID | FK → stores.id, NOT NULL |
| original_sale_id | UUID | FK → sales.id, NOT NULL |
| return_number | VARCHAR(50) | NOT NULL |
| reason | TEXT | |
| total_refunded | INT | NOT NULL |
| status | return_status_enum | DEFAULT 'completed' |
| created_by | UUID | FK → users.id, NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

### 7.5 sale_return_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| return_id | UUID | FK → sale_returns.id, NOT NULL |
| sale_item_id | UUID | FK → sale_items.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| quantity | INT | NOT NULL |
| unit_price | INT | NOT NULL |
| tva_rate | SMALLINT | NOT NULL |
| refund_amount | INT | NOT NULL |
| reason | TEXT | |

### 7.6 pos_sessions (cashier shifts)

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| store_id | UUID | FK → stores.id, NOT NULL |
| cashier_id | UUID | FK → users.id, NOT NULL |
| terminal_name | VARCHAR(50) | NOT NULL |
| opened_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| closed_at | TIMESTAMPTZ | |
| opening_cash | INT | NOT NULL | Cash in drawer at session start (centimes) |
| closing_cash | INT | | Cash counted at close |
| expected_cash | INT | | Calculated expected cash |
| cash_difference | INT | | closing - expected |
| total_sales | INT | DEFAULT 0 | Sum of all sales in session |
| total_refunds | INT | DEFAULT 0 | Sum of all refunds in session |
| status | pos_session_status_enum | DEFAULT 'open' |

### 7.7 pos_cash_movements

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| session_id | UUID | FK → pos_sessions.id, NOT NULL |
| movement_type | cash_movement_type_enum | NOT NULL |
| amount | INT | NOT NULL |
| reason | TEXT | |
| created_by | UUID | FK → users.id, NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Enum: cash_movement_type_enum:** OPENING, CLOSING, WITHDRAWAL, DEPOSIT, ADJUSTMENT

---

## 8. Purchasing & Supplier Tables

### 8.1 suppliers

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| nif | VARCHAR(20) | | Supplier NIF |
| rc | VARCHAR(30) | | Supplier RC |
| contact_person | VARCHAR(255) | | |
| phone | VARCHAR(20) | | |
| email | VARCHAR(255) | | |
| address | TEXT | | |
| city | VARCHAR(100) | | |
| wilaya | VARCHAR(100) | | |
| bank_name | VARCHAR(255) | | |
| bank_account | VARCHAR(100) | | |
| payment_terms | INT | DEFAULT 0 | Payment delay in days (0 = immediate) |
| lead_time_days | INT | DEFAULT 3 | Average delivery time in days |
| rating | DECIMAL(3,2) | | MCDA composite score (0-1) |
| notes | TEXT | | |
| is_active | BOOLEAN | DEFAULT true | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | |

### 8.2 supplier_contacts

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| supplier_id | UUID | FK → suppliers.id, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| role | VARCHAR(100) | |
| phone | VARCHAR(20) | |
| email | VARCHAR(255) | |
| is_primary | BOOLEAN | DEFAULT false |

### 8.3 supplier_products

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| supplier_id | UUID | FK → suppliers.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| supplier_sku | VARCHAR(100) | |
| supplier_product_name | VARCHAR(500) | |
| unit_price | INT | Supplier's price in centimes |
| min_order_quantity | INT | DEFAULT 1 |
| delivery_time_days | INT | |
| is_preferred | BOOLEAN | DEFAULT false |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Unique:** `(tenant_id, supplier_id, product_id)`

### 8.4 purchase_orders

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| po_number | VARCHAR(50) | NOT NULL, sequential |
| supplier_id | UUID | FK → suppliers.id, NOT NULL |
| store_id | UUID | FK → stores.id, NOT NULL |
| status | po_status_enum | DEFAULT 'draft' |
| ordered_at | TIMESTAMPTZ | |
| expected_delivery_date | DATE | |
| notes | TEXT | |
| subtotal | INT | DEFAULT 0 |
| tva_amount | INT | DEFAULT 0 |
| total | INT | DEFAULT 0 |
| currency | VARCHAR(3) | DEFAULT 'DZD' |
| created_by | UUID | FK → users.id |
| approved_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| deleted_at | TIMESTAMPTZ | |

**Enum: po_status_enum:** draft, pending_approval, approved, ordered, partially_received, received, cancelled

### 8.5 purchase_order_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| po_id | UUID | FK → purchase_orders.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| quantity_ordered | INT | NOT NULL |
| quantity_received | INT | DEFAULT 0 |
| unit_price | INT | NOT NULL |
| tva_rate | SMALLINT | NOT NULL |
| subtotal | INT | NOT NULL |
| tva_amount | INT | NOT NULL |
| total | INT | NOT NULL |
| notes | TEXT | |

### 8.6 purchase_deliveries

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| po_id | UUID | FK → purchase_orders.id, NOT NULL |
| delivery_number | VARCHAR(50) | NOT NULL |
| delivered_at | TIMESTAMPTZ | |
| received_by | UUID | FK → users.id |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

### 8.7 purchase_delivery_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| delivery_id | UUID | FK → purchase_deliveries.id, NOT NULL |
| po_item_id | UUID | FK → purchase_order_items.id, NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| quantity_delivered | INT | NOT NULL |
| batch_number | VARCHAR(100) | |
| expiration_date | DATE | |
| unit_cost | INT | |

---

## 9. Financial Tables

### 9.1 invoices

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | |
| tenant_id | UUID | NOT NULL | |
| invoice_number | VARCHAR(20) | NOT NULL | Format: YYYY-NNNNN |
| sale_id | UUID | FK → sales.id | Linked sale (if any) |
| customer_id | UUID | FK → customers.id | |
| customer_name | VARCHAR(500) | | Snapshot |
| customer_address | TEXT | | Snapshot |
| customer_nif | VARCHAR(20) | | Snapshot |
| issue_date | DATE | NOT NULL | |
| due_date | DATE | | |
| subtotal | INT | NOT NULL | |
| discount_amount | INT | DEFAULT 0 | |
| tva_amount | INT | NOT NULL | |
| tva_details | JSONB | NOT NULL | `{ "19": amount, "9": amount, "0": amount }` |
| tax_stamp_amount | INT | NOT NULL | |
| total_ttc | INT | NOT NULL | |
| net_to_pay | INT | NOT NULL | total_ttc + tax_stamp |
| amount_in_words | TEXT | | French text: "Neuf mille sept cent deux dinars..." |
| payment_terms | TEXT | | "À réception", "30 jours", etc. |
| status | invoice_status_enum | DEFAULT 'issued' | |
| notes | TEXT | | |
| pdf_url | VARCHAR(500) | | Generated PDF path |
| created_by | UUID | FK → users.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Critical:** Invoice numbers must be sequential per tenant with no gaps. This is enforced via a database sequence per tenant:
```sql
CREATE TABLE invoice_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  last_number INT NOT NULL DEFAULT 0,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
);
```

### 9.2 invoice_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| invoice_id | UUID | FK → invoices.id, NOT NULL |
| line_number | INT | NOT NULL |
| product_id | UUID | FK → products.id |
| description | VARCHAR(500) | NOT NULL |
| quantity | INT | NOT NULL |
| unit | VARCHAR(20) | NOT NULL |
| unit_price | INT | NOT NULL |
| tva_rate | SMALLINT | NOT NULL |
| amount_ht | INT | NOT NULL |
| tva_amount | INT | NOT NULL |
| amount_ttc | INT | NOT NULL |

### 9.3 expenses

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| store_id | UUID | FK → stores.id |
| category_id | UUID | FK → expense_categories.id |
| description | VARCHAR(500) | NOT NULL |
| amount | INT | NOT NULL |
| tva_rate | SMALLINT | DEFAULT 0 |
| expense_date | DATE | NOT NULL |
| payment_method | payment_method_enum | NOT NULL |
| reference | VARCHAR(100) | |
| supplier_id | UUID | FK → suppliers.id |
| receipt_url | VARCHAR(500) | |
| notes | TEXT | |
| created_by | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| deleted_at | TIMESTAMPTZ | |

### 9.4 expense_categories

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| parent_id | UUID | FK → expense_categories.id |
| description | TEXT | |
| is_active | BOOLEAN | DEFAULT true |

---

## 10. Customer Tables

### 10.1 customers

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| name | VARCHAR(500) | NOT NULL |
| phone | VARCHAR(20) | |
| email | VARCHAR(255) | |
| address | TEXT | |
| city | VARCHAR(100) | |
| nif | VARCHAR(20) | |
| customer_type | customer_type_enum | DEFAULT 'regular' |
| credit_limit | INT | DEFAULT 0 |
| current_debt | INT | DEFAULT 0 |
| loyalty_points | INT | DEFAULT 0 |
| total_purchases | INT | DEFAULT 0 |
| total_spent | INT | DEFAULT 0 |
| visit_count | INT | DEFAULT 0 |
| last_visit_at | TIMESTAMPTZ | |
| notes | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| deleted_at | TIMESTAMPTZ | |

**Enum: customer_type_enum:** walk_in, regular, vip, wholesale

### 10.2 loyalty_point_transactions

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| customer_id | UUID | FK → customers.id, NOT NULL |
| points | INT | NOT NULL | Positive = earned, Negative = redeemed |
| balance_after | INT | NOT NULL | Points balance after this transaction |
| reason | VARCHAR(100) | NOT NULL | 'purchase', 'redemption', 'expiry', 'adjustment' |
| reference_id | UUID | | Linked sale or redemption |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

### 10.3 customer_debts

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| customer_id | UUID | FK → customers.id, NOT NULL |
| amount | INT | NOT NULL |
| remaining | INT | NOT NULL |
| sale_id | UUID | FK → sales.id |
| due_date | DATE | |
| status | debt_status_enum | DEFAULT 'outstanding' |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

---

## 11. Employee Tables

### 11.1 employees

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| user_id | UUID | FK → users.id | Link to system user account |
| first_name | VARCHAR(100) | NOT NULL |
| last_name | VARCHAR(100) | NOT NULL |
| date_of_birth | DATE | |
| phone | VARCHAR(20) | |
| email | VARCHAR(255) | |
| address | TEXT | |
| position | VARCHAR(100) | |
| department | VARCHAR(100) | |
| hire_date | DATE | |
| salary | INT | Monthly salary in centimes |
| contract_type | contract_type_enum | DEFAULT 'cdi' |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| deleted_at | TIMESTAMPTZ | |

---

## 12. AI & Optimization Tables

### 12.1 supplier_evaluations

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| supplier_id | UUID | FK → suppliers.id, NOT NULL |
| evaluation_period | VARCHAR(50) | NOT NULL |
| method | evaluation_method_enum | NOT NULL |
| criteria_weights | JSONB | NOT NULL | `{ "price": 0.35, "quality": 0.25, ... }` |
| supplier_scores | JSONB | NOT NULL | `{ "supplier_A": { "score": 0.87, "rank": 1 }, ... }` |
| consistency_ratio | DECIMAL(5,4) | | AHP consistency ratio |
| evaluated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| evaluated_by | UUID | FK → users.id |

**Enum: evaluation_method_enum:** ahp_topsis, ahp_promethee, ahp_only, topsis_only

### 12.2 demand_forecasts

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| product_id | UUID | FK → products.id, NOT NULL |
| store_id | UUID | FK → stores.id, NOT NULL |
| forecast_date | DATE | NOT NULL |
| predicted_quantity | INT | NOT NULL |
| predicted_lower | INT | | Lower bound (95% CI) |
| predicted_upper | INT | | Upper bound (95% CI) |
| model_used | VARCHAR(50) | NOT NULL |
| model_version | VARCHAR(50) | |
| accuracy_mape | DECIMAL(5,2) | | MAPE of last forecast vs actual |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Unique:** `(tenant_id, product_id, store_id, forecast_date)`

### 12.3 ai_recommendations

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| store_id | UUID | FK → stores.id |
| recommendation_type | recommendation_type_enum | NOT NULL |
| title | VARCHAR(500) | NOT NULL |
| description | TEXT | NOT NULL |
| data | JSONB | | Structured recommendation data |
| priority | priority_enum | DEFAULT 'medium' |
| is_read | BOOLEAN | DEFAULT false |
| is_actioned | BOOLEAN | DEFAULT false |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

---

## 13. Audit & System Tables

### 13.1 audit_logs

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| user_id | UUID | FK → users.id |
| entity_type | VARCHAR(100) | NOT NULL |
| entity_id | UUID | NOT NULL |
| action | VARCHAR(20) | NOT NULL |
| changes | JSONB | |
| ip_address | VARCHAR(45) | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Indexes:** `tenant_id`, `entity_type`, `entity_id`, `user_id`, `created_at`
**Partitioning (recommended for production):** Range partition by `created_at` (monthly)

---

## 14. Enums Summary

| Enum Name | Values |
|---|---|
| `subscription_status_enum` | trial, active, suspended, cancelled |
| `stock_movement_type_enum` | PURCHASE_IN, SALE_OUT, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN_IN, RETURN_OUT, WRITE_OFF |
| `transfer_status_enum` | draft, pending, in_transit, received, cancelled |
| `count_status_enum` | in_progress, pending_review, approved, cancelled |
| `adjustment_status_enum` | pending, approved, rejected |
| `sale_status_enum` | completed, voided, held |
| `payment_method_enum` | CASH, CARD, CHECK, TRANSFER, MIXED |
| `return_status_enum` | pending, completed, cancelled |
| `pos_session_status_enum` | open, closed |
| `cash_movement_type_enum` | OPENING, CLOSING, WITHDRAWAL, DEPOSIT, ADJUSTMENT |
| `po_status_enum` | draft, pending_approval, approved, ordered, partially_received, received, cancelled |
| `invoice_status_enum` | draft, issued, paid, partially_paid, overdue, cancelled |
| `debt_status_enum` | outstanding, partially_paid, paid, written_off |
| `customer_type_enum` | walk_in, regular, vip, wholesale |
| `contract_type_enum` | cdi, cdd, interim, freelance |
| `evaluation_method_enum` | ahp_topsis, ahp_promethee, ahp_only, topsis_only |
| `recommendation_type_enum` | reorder, supplier_switch, price_change, markdown, promotion, staffing, waste_prevention |
| `priority_enum` | low, medium, high, urgent |

---

## 15. Prisma Schema Skeleton

Below is the Prisma schema structure. Use this as the starting point for `prisma/schema.prisma`. The actual schema file should include all models, relations, and indexes defined above.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [pg_trgm, "uuid-ossp", pgcrypto]
}

// === SYSTEM TABLES ===

model Tenant {
  id                   String   @id @default(uuid()) @db.Uuid
  name                 String   @db.VarChar(255)
  slug                 String   @unique @db.VarChar(100)
  // ... (all fields from section 4.1)
  stores               Store[]
  users                User[]
  // ... other relations
  @@map("tenants")
}

// ... (all other models following the same pattern)
```

**Important Prisma Notes:**
- Use `@map("table_name")` to match the PostgreSQL table names.
- Use `@db.Uuid` for UUID columns.
- Use `Int` for monetary values (centimes).
- Use `Json` for JSONB columns.
- Use `@relation` for foreign keys.
- RLS is handled at the PostgreSQL level, not in Prisma. But the Prisma middleware should set the session variable.