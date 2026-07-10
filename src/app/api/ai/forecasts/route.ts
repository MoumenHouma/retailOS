import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ListForecastsQuerySchema } from "@/lib/validators/ai";
import { listForecasts } from "@/server/services/forecasting";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "ai:view_recommendations");
    const { searchParams } = new URL(request.url);
    const parsed = ListForecastsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const points = await withTenant(session!.user.tenantId, (tx) => listForecasts(tx, parsed.data));
    return apiSuccess(points);
  } catch (error) {
    return mapServiceError(error);
  }
}
