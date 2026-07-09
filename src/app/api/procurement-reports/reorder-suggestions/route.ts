import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getReorderSuggestions } from "@/server/services/procurement-reports";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const suggestions = await withTenant(session!.user.tenantId, (tx) => getReorderSuggestions(tx));
    return apiSuccess(suggestions);
  } catch (error) {
    return mapServiceError(error);
  }
}
