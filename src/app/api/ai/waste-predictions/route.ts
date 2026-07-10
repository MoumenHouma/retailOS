import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { predictExpirationRisk } from "@/server/services/waste-prediction";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "ai:view_recommendations");
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId") ?? undefined;

    const risks = await withTenant(session!.user.tenantId, (tx) =>
      predictExpirationRisk(tx, { storeId }),
    );
    return apiSuccess(risks);
  } catch (error) {
    return mapServiceError(error);
  }
}
