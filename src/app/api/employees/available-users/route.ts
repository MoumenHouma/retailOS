import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listTenantUsers } from "@/server/services/roles";

// Feeds the Employee form's "linked user account" picker — without this,
// there is no way to populate Employee.userId through the UI at all, and
// calculateCommissionsForPeriod's Sale.cashierId -> Employee.userId join
// (the whole point of the commission feature) would never match anything.
// Gated on employees:manage (not employees:roles) since linking an employee
// to their own already-existing login is an employee-management action, not
// an RBAC action.
export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:manage");
    const users = await withTenant(session!.user.tenantId, (tx) => listTenantUsers(tx));
    return apiSuccess(users);
  } catch (error) {
    return mapServiceError(error);
  }
}
