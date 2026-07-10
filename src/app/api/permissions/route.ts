import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listPermissionCatalog } from "@/server/services/roles";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:roles");
    const catalog = await withTenant(session!.user.tenantId, (tx) => listPermissionCatalog(tx));
    return apiSuccess(catalog);
  } catch (error) {
    return mapServiceError(error);
  }
}
