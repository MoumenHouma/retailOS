import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BCRYPT_SALT_ROUNDS, SYSTEM_ROLES, type SystemRole } from "../src/lib/constants";
import {
  DEFAULT_UNITS,
  PERMISSION_CATALOG,
  ROLE_PERMISSIONS,
} from "../src/lib/permission-catalog";

// Seed always connects as the superuser (DATABASE_URL) — it legitimately
// spans multiple tenants, which RLS would otherwise block.
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

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

    // Phase 6 Chunk D: a real second store + multi-store UserStore
    // assignment for tenant-a's demo admin — closes the gap flagged in the
    // 2026-07-09 Dev Log entry (userStores[0] reportedly resolving empty)
    // and gives Chunk C's multi-store dashboard/store-access-control
    // something real to exercise without hand-editing the DB.
    if (spec.slug === "demo-tenant-a") {
      const secondStore =
        (await prisma.store.findFirst({ where: { tenantId: tenant.id, isMain: false } })) ??
        (await prisma.store.create({
          data: { tenantId: tenant.id, name: `${spec.name} — Magasin Centre-ville`, isMain: false },
        }));
      await prisma.userStore.upsert({
        where: { userId_storeId: { userId: adminUser.id, storeId: secondStore.id } },
        update: {},
        create: { userId: adminUser.id, storeId: secondStore.id },
      });
    }

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
