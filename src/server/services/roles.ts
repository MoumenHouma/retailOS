import type { Prisma } from "@prisma/client";
import type { AssignUserRoleInput, CreateRoleInput, UpdateRolePermissionsInput } from "@/lib/validators/roles";

type TransactionClient = Prisma.TransactionClient;

// Role predates the dbgenerated-tenantId-default convention every later
// Phase 3/4 model uses (Phase 0's schema.prisma header comment), so tenantId
// has to be threaded through explicitly here rather than left to the column
// default withTenant's session variable otherwise satisfies automatically.
export async function createRole(tx: TransactionClient, tenantId: string, input: CreateRoleInput) {
  return tx.role.create({ data: { ...input, tenantId } });
}

export async function updateRolePermissions(
  tx: TransactionClient,
  roleId: string,
  input: UpdateRolePermissionsInput,
) {
  const permissions = await tx.permission.findMany({ where: { name: { in: input.permissionNames } } });

  // Full-replace semantics (delete then recreate the junction rows) — the
  // permission checkbox grid always submits the complete desired set, not a
  // delta, so there's no incremental-diff case to handle.
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (permissions.length > 0) {
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
    });
  }

  return listRoleWithPermissions(tx, roleId);
}

export async function assignUserRole(tx: TransactionClient, roleId: string, input: AssignUserRoleInput) {
  const storeId = input.storeId ?? null;
  // findFirst-then-create/update rather than relying on the compound unique
  // key's generated WhereUniqueInput shape — same pattern customer-pricing.ts
  // already uses for its own nullable-free compound key, sidesteps Prisma's
  // typing of nullable columns inside compound-unique lookups entirely.
  const existing = await tx.userRole.findFirst({ where: { userId: input.userId, roleId, storeId } });
  if (existing) {
    return existing;
  }
  return tx.userRole.create({ data: { userId: input.userId, roleId, storeId } });
}

export async function revokeUserRole(tx: TransactionClient, userRoleId: string): Promise<void> {
  await tx.userRole.delete({ where: { id: userRoleId } });
}

async function listRoleWithPermissions(tx: TransactionClient, roleId: string) {
  return tx.role.findUniqueOrThrow({
    where: { id: roleId },
    include: {
      rolePermissions: { include: { permission: true } },
      userRoles: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          store: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function listRoles(tx: TransactionClient) {
  return tx.role.findMany({
    include: {
      rolePermissions: { include: { permission: true } },
      userRoles: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          store: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

/** Global permission catalog grouped by module — feeds the Roles page's permission checkbox grid. */
export async function listPermissionCatalog(tx: TransactionClient) {
  const permissions = await tx.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] });
  const byModule = new Map<string, typeof permissions>();
  for (const permission of permissions) {
    const bucket = byModule.get(permission.module) ?? [];
    bucket.push(permission);
    byModule.set(permission.module, bucket);
  }
  return [...byModule.entries()].map(([module, perms]) => ({ module, permissions: perms }));
}

/** Feeds the Roles page's user-assignment picker — no in-app user creation flow exists yet (users are only created via registration), so this just lists who's already in the tenant. */
export async function listTenantUsers(tx: TransactionClient) {
  return tx.user.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });
}
