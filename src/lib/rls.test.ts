import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma, withTenant } from "./prisma";

// Integration test: requires a live Postgres reachable via DATABASE_URL /
// DATABASE_APP_URL with migrations applied and the app_user role/RLS
// policies in place (see docker/postgres/init/01-roles.sql + the hand-edited
// migration SQL). This is the automated version of the ROADMAP.md Phase 0
// exit criterion: "logging in as Tenant A cannot see Tenant B's data."
const superuser = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

let tenantAId: string;
let tenantBId: string;

beforeAll(async () => {
  const tenantA = await superuser.tenant.create({
    data: {
      name: "RLS Test Tenant A",
      slug: `rls-test-a-${Date.now()}`,
      nif: "111111111111111",
      nis: "111111111",
      rc: "16/00-1111111A26",
    },
  });
  const tenantB = await superuser.tenant.create({
    data: {
      name: "RLS Test Tenant B",
      slug: `rls-test-b-${Date.now()}`,
      nif: "222222222222222",
      nis: "222222222",
      rc: "16/00-2222222A26",
    },
  });
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  await superuser.store.create({ data: { tenantId: tenantAId, name: "Tenant A Store" } });
  await superuser.store.create({ data: { tenantId: tenantBId, name: "Tenant B Store" } });
});

afterAll(async () => {
  await superuser.store.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
  await superuser.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  await superuser.$disconnect();
});

describe("Row-Level Security tenant isolation", () => {
  it("only returns the bound tenant's own stores", async () => {
    const storesAsTenantA = await withTenant(tenantAId, (tx) => tx.store.findMany());
    expect(storesAsTenantA).toHaveLength(1);
    expect(storesAsTenantA[0]?.tenantId).toBe(tenantAId);

    const storesAsTenantB = await withTenant(tenantBId, (tx) => tx.store.findMany());
    expect(storesAsTenantB).toHaveLength(1);
    expect(storesAsTenantB[0]?.tenantId).toBe(tenantBId);
  });

  it("returns zero rows when no tenant context is bound but app_user is used", async () => {
    // No withTenant() wrapper here — app.current_tenant_id is never set, so
    // the RLS policy (using current_setting(..., true)) should fail closed.
    const storesUnscoped = await prisma.store.findMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    expect(storesUnscoped).toHaveLength(0);
  });
});
