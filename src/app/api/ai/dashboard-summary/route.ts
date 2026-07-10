import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getDashboardSummary } from "@/server/services/ai-dashboard";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "ai:view_recommendations");
    const summary = await withTenant(session!.user.tenantId, (tx) => getDashboardSummary(tx));
    return apiSuccess(summary);
  } catch (error) {
    return mapServiceError(error);
  }
}
