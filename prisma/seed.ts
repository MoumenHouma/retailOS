import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BCRYPT_SALT_ROUNDS, SYSTEM_ROLES, type SystemRole } from "../src/lib/constants";

// Seed always connects as the superuser (DATABASE_URL) — it legitimately
// spans multiple tenants, which RLS would otherwise block.
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

// Concrete permission catalog, expanding the module:* shorthand from
// ARCHITECTURE.md §6.2 into individual permission strings. Deliberately not
// typed as Record<string, string[]> — with noUncheckedIndexedAccess, a
// generic index signature makes every access (even dot-notation on known
// keys) come back as `string[] | undefined`. An explicit key union avoids
// that since these are named properties, not an index signature.
const PERMISSION_CATALOG: Record<
  "products" | "inventory" | "pos" | "purchases" | "suppliers" | "customers" | "finance" | "employees" | "reports" | "ai",
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
  reports: ["reports:view", "reports:export"],
  ai: ["ai:view_recommendations", "ai:run_forecast"],
};

const ALL_PERMISSIONS = Object.values(PERMISSION_CATALOG).flat();

// Role -> permission mapping per ARCHITECTURE.md §6.2 (PLATFORM_ADMIN is
// cross-tenant and deliberately excluded from Phase 0 seeding — see
// src/lib/constants.ts).
const ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  BUSINESS_OWNER: ALL_PERMISSIONS,
  // Phase 4 Chunk D: a STORE_MANAGER already couldn't self-escalate via
  // employees:manage; widened to also exclude employees:payroll (salary
  // visibility/edits, commission-rule configuration) and employees:roles
  // (the RBAC admin UI itself — letting a manager grant itself
  // employees:manage through the Roles page would be a privilege-escalation
  // hole) while still keeping employees:schedule for day-to-day staffing.
  STORE_MANAGER: ALL_PERMISSIONS.filter(
    (p) => p !== "employees:manage" && p !== "employees:payroll" && p !== "employees:roles",
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
    ...PERMISSION_CATALOG.reports,
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

interface DemoTenantSpec {
  name: string;
  slug: string;
  nif: string;
  nis: string;
  rc: string;
  adminEmail: string;
}

const DEMO_TENANTS: DemoTenantSpec[] = [
  {
    name: "Supermarché El Amel Démo",
    slug: "demo-tenant-a",
    nif: "000000000000001",
    nis: "000000001",
    rc: "16/00-0000001A26",
    adminEmail: "admin@tenant-a.demo",
  },
  {
    name: "Épicerie Moderne Démo",
    slug: "demo-tenant-b",
    nif: "000000000000002",
    nis: "000000002",
    rc: "16/00-0000002A26",
    adminEmail: "admin@tenant-b.demo",
  },
];

const DEMO_PASSWORD = "Demo1234!";

const DEFAULT_UNITS = [
  { name: "Pièce", abbreviation: "pce", isBaseUnit: true },
  { name: "Kilogramme", abbreviation: "kg", isBaseUnit: false },
  { name: "Litre", abbreviation: "L", isBaseUnit: false },
  { name: "Carton", abbreviation: "carton", isBaseUnit: false },
];

async function main() {
  console.log("Seeding permission catalog...");
  const permissionsByName = new Map<string, { id: string }>();
  for (const [module, names] of Object.entries(PERMISSION_CATALOG)) {
    for (const name of names) {
      const permission = await prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, module },
      });
      permissionsByName.set(name, permission);
    }
  }

  for (const spec of DEMO_TENANTS) {
    console.log(`Seeding tenant "${spec.name}"...`);

    const tenant = await prisma.tenant.upsert({
      where: { slug: spec.slug },
      update: {},
      create: { name: spec.name, slug: spec.slug, nif: spec.nif, nis: spec.nis, rc: spec.rc },
    });

    const store =
      (await prisma.store.findFirst({ where: { tenantId: tenant.id, isMain: true } })) ??
      (await prisma.store.create({
        data: { tenantId: tenant.id, name: `${spec.name} — Magasin principal`, isMain: true },
      }));

    const roleByName = new Map<SystemRole, { id: string }>();
    for (const roleName of SYSTEM_ROLES) {
      const role = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
        update: {},
        create: { tenantId: tenant.id, name: roleName, isSystem: true },
      });
      roleByName.set(roleName, role);

      for (const permName of ROLE_PERMISSIONS[roleName]) {
        const permission = permissionsByName.get(permName);
        if (!permission) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }

    const ownerRole = roleByName.get("BUSINESS_OWNER")!;
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

    const adminUser = await prisma.user.upsert({
      where: { email: spec.adminEmail },
      update: {},
      create: {
        tenantId: tenant.id,
        email: spec.adminEmail,
        passwordHash,
        firstName: "Admin",
        lastName: spec.name,
      },
    });

    // storeId is nullable, and Prisma's compound-unique `where` accessor
    // can't take null (Postgres treats each NULL as distinct in a unique
    // index, so it isn't usable as a lookup key) — upsert() doesn't apply
    // here, hence the manual findFirst/create.
    const existingOwnerUserRole = await prisma.userRole.findFirst({
      where: { userId: adminUser.id, roleId: ownerRole.id, storeId: null },
    });
    if (!existingOwnerUserRole) {
      await prisma.userRole.create({ data: { userId: adminUser.id, roleId: ownerRole.id } });
    }

    await prisma.userStore.upsert({
      where: { userId_storeId: { userId: adminUser.id, storeId: store.id } },
      update: {},
      create: { userId: adminUser.id, storeId: store.id },
    });

    // Units have no compound-unique key to upsert against — guard
    // idempotency with an existence check instead, same pattern as the
    // owner user-role above.
    for (const unit of DEFAULT_UNITS) {
      const existingUnit = await prisma.unit.findFirst({
        where: { tenantId: tenant.id, abbreviation: unit.abbreviation, deletedAt: null },
      });
      if (!existingUnit) {
        await prisma.unit.create({ data: { tenantId: tenant.id, ...unit } });
      }
    }

    console.log(`  -> login with ${spec.adminEmail} / ${DEMO_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
