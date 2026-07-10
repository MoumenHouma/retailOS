import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { RecomputeOptimizationSchema } from "@/lib/validators/ai";
import { recomputeStoreOptimization } from "@/server/services/inventory-optimization";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "ai:run_forecast");
    const body = await request.json();
    const parsed = RecomputeOptimizationSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await withTenant(session!.user.tenantId, (tx) =>
      recomputeStoreOptimization(tx, parsed.data),
    );
    return apiSuccess(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
