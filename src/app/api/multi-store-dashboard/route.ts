import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getMultiStoreSummary } from "@/server/services/multi-store-dashboard";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const summary = await withTenant(session!.user.tenantId, (tx) => getMultiStoreSummary(tx));
    return apiSuccess(summary);
  } catch (error) {
    return mapServiceError(error);
  }
}
