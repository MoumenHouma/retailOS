import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateRecommendationSchema } from "@/lib/validators/ai";
import { updateRecommendation } from "@/server/services/ai-recommendations";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "ai:view_recommendations");
    const body = await request.json();
    const parsed = UpdateRecommendationSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const recommendation = await withTenant(session!.user.tenantId, (tx) =>
      updateRecommendation(tx, id, parsed.data),
    );
    return apiSuccess(recommendation);
  } catch (error) {
    return mapServiceError(error);
  }
}
