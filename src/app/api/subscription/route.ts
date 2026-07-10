import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "subscription:read");
    const tenant = await withTenant(session!.user.tenantId, (tx) =>
      tx.tenant.findUniqueOrThrow({
        where: { id: session!.user.tenantId },
        select: { subscriptionPlan: true, subscriptionStatus: true, subscriptionEndsAt: true, name: true },
      }),
    );
    return apiSuccess(tenant);
  } catch (error) {
    return mapServiceError(error);
  }
}
