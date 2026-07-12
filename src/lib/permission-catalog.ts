import type { SystemRole } from "@/lib/constants";

// Concrete permission catalog, expanding the module:* shorthand from
// ARCHITECTURE.md §6.2 into individual permission strings. Lived in
// prisma/seed.ts until the desktop edition's first real registration
// exposed that /api/auth/register created system roles with zero
// permissions attached (the seed was the only thing that ever wired
// RolePermission rows, so only demo tenants ever worked) — shared here so
// the register route and the seed provision tenants identically.
//
// Deliberately not typed as Record<string, string[]> — with
// noUncheckedIndexedAccess, a generic index signature makes every access
// (even dot-notation on known keys) come back as `string[] | undefined`.
// An explicit key union avoids that since these are named properties, not
// an index signature.
export const PERMISSION_CATALOG: Record<
  | "products"
  | "inventory"
  | "pos"
  | "purchases"
  | "suppliers"
  | "customers"
  | "finance"
  | "employees"
  | "reports"
  | "ai"
  | "stores"
  | "subscription",
  string[]
> = {
  products: ["products:read", "products:create", "products:update", "products:delete"],
  inventory: ["inventory:read", "inventory:adjust", "inventory:count", "inventory:transfer"],
  pos: ["pos:operate", "pos:refund", "pos:discount", "pos:open_drawer"],
  purchases: ["purchases:read", "purchases:create", "purchases:approve"],
  suppliers: [
    "suppliers:read",
    "suppliers:create",
    "suppliers:update",
    "suppliers:delete",
    // Phase 5 Chunk C: running an MCDA evaluation is a purchasing-strategy
    // write action, distinct from suppliers:update's master-data-edit
    // meaning — same "narrow, sensitivity-scoped permission" precedent as
    // Phase 4's finance:period/employees:payroll.
    "suppliers:evaluate",
  ],
  customers: ["customers:read", "customers:create", "customers:update", "customers:delete"],
  finance: [
    "finance:read",
    "finance:invoice",
    "finance:report",
    "finance:expense",
    "finance:payment",
    "finance:period",
  ],
  employees: [
    "employees:read",
    "employees:manage",
    "employees:schedule",
    "employees:payroll",
    "employees:roles",
  ],
  reports: [
    "reports:view",
    "reports:export",
    // Phase 6 Chunk A: dashboard-layout editing + scheduled-report CRUD —
    // BUSINESS_OWNER/STORE_MANAGER only, filtered out of ACCOUNTANT's
    // `...PERMISSION_CATALOG.reports` spread below, same narrow-grant
    // precedent as finance:period/employees:payroll.
    "reports:customize",
  ],
  ai: ["ai:view_recommendations", "ai:run_forecast"],
  // Phase 6 Chunk C — BUSINESS_OWNER-only (not spread into STORE_MANAGER's
  // ALL_PERMISSIONS the way most catalog entries are; filtered out below).
  stores: ["stores:create", "stores:manage"],
  subscription: ["subscription:read", "subscription:manage"],
};

export const ALL_PERMISSIONS = Object.values(PERMISSION_CATALOG).flat();

// Role -> permission mapping per ARCHITECTURE.md §6.2 (PLATFORM_ADMIN is
// cross-tenant and deliberately excluded — see src/lib/constants.ts).
export const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  BUSINESS_OWNER: ALL_PERMISSIONS,
  // Phase 4 Chunk D: a STORE_MANAGER already couldn't self-escalate via
  // employees:manage; widened to also exclude employees:payroll (salary
  // visibility/edits, commission-rule configuration) and employees:roles
  // (the RBAC admin UI itself — letting a manager grant itself
  // employees:manage through the Roles page would be a privilege-escalation
  // hole) while still keeping employees:schedule for day-to-day staffing.
  STORE_MANAGER: ALL_PERMISSIONS.filter(
    (p) =>
      p !== "employees:manage" &&
      p !== "employees:payroll" &&
      p !== "employees:roles" &&
      // Phase 6 Chunk C: multi-store setup (adding stores, assigning users
      // to them) and subscription/billing stay ownership-level, same
      // posture as the employees:* exclusions above.
      p !== "stores:create" &&
      p !== "stores:manage" &&
      p !== "subscription:read" &&
      p !== "subscription:manage",
  ),
  CASHIER: [...PERMISSION_CATALOG.pos, "products:read", "customers:read", "customers:create"],
  INVENTORY_CLERK: [
    ...PERMISSION_CATALOG.inventory,
    "products:read",
    "suppliers:read",
    // Chunk B (receiving) gap flagged in PHASE3_PURCHASING_PLAN.md: this
    // role could already adjust/count/transfer stock but had no way to
    // view the POs it would be receiving deliveries against.
    "purchases:read",
    // Phase 5 Chunk B gap fix: this role acts on reorder/waste
    // recommendations day-to-day but previously had zero ai:* permission at
    // all — same "found and fixed a role gap" pattern as purchases:read
    // above. ai:run_forecast (triggering compute, real infra cost) stays
    // BUSINESS_OWNER/STORE_MANAGER-only.
    "ai:view_recommendations",
  ],
  ACCOUNTANT: [
    ...PERMISSION_CATALOG.finance,
    ...PERMISSION_CATALOG.reports.filter((p) => p !== "reports:customize"),
    "products:read",
    "suppliers:read",
    // Phase 4 Chunk B gap fix: needs debt/AR visibility for financial
    // reporting but previously had no customers:* permission at all — same
    // "found and fixed a role gap" pattern Phase 3 used for
    // INVENTORY_CLERK + purchases:read.
    "customers:read",
    // Phase 4 Chunk D: headcount/payroll-cost reporting needs read access,
    // not payroll edits or RBAC — same narrow-grant precedent as customers:read above.
    "employees:read",
  ],
};

// Default units every new tenant starts with (used by both the seed and
// tenant registration — products can't be created without at least one
// unit).
export const DEFAULT_UNITS = [
  { name: "Pièce", abbreviation: "pce", isBaseUnit: true },
  { name: "Kilogramme", abbreviation: "kg", isBaseUnit: false },
  { name: "Litre", abbreviation: "L", isBaseUnit: false },
  { name: "Carton", abbreviation: "carton", isBaseUnit: false },
] as const;
