import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listStores } from "@/server/services/stores";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const stores = await withTenant(session!.user.tenantId, (tx) => listStores(tx));
    return apiSuccess(stores);
  } catch (error) {
    return mapServiceError(error);
  }
}
