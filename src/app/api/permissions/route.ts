import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listPermissionCatalog } from "@/server/services/roles";

// Permission is a global, non-RLS-scoped table (no tenantId column) — the
// cache key needs no tenant scoping even though the query still runs
// through withTenant (required for the connection's RLS context).
const getCachedPermissionCatalog = unstable_cache(
  (tenantId: string) => withTenant(tenantId, (tx) => listPermissionCatalog(tx)),
  ["permission-catalog"],
  { revalidate: 300 },
);

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:roles");
    const catalog = await getCachedPermissionCatalog(session!.user.tenantId);
    return apiSuccess(catalog);
  } catch (error) {
    return mapServiceError(error);
  }
}
