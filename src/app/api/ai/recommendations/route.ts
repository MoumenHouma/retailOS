import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ListRecommendationsQuerySchema } from "@/lib/validators/ai";
import { listRecommendations } from "@/server/services/ai-recommendations";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "ai:view_recommendations");
    const { searchParams } = new URL(request.url);
    const parsed = ListRecommendationsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => listRecommendations(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}
