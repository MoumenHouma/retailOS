import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listTenantUsers } from "@/server/services/roles";

// Not in PHASE4_FINANCE_PLAN.md's own route list — a small, necessary
// addition so the Roles page's user-assignment picker has someone to pick
// from. No in-app "create user" flow exists yet (users are only created via
// /api/auth/register), so this just lists who's already in the tenant.
export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:roles");
    const users = await withTenant(session!.user.tenantId, (tx) => listTenantUsers(tx));
    return apiSuccess(users);
  } catch (error) {
    return mapServiceError(error);
  }
}
