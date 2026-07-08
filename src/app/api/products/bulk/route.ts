import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { BulkProductActionSchema } from "@/lib/validators/products";
import { bulkProductAction } from "@/server/services/products";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:update");
    const body = await request.json();
    const parsed = BulkProductActionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const count = await withTenant(session!.user.tenantId, (tx) =>
      bulkProductAction(tx, parsed.data),
    );
    return apiSuccess({ updated: count });
  } catch (error) {
    return mapServiceError(error);
  }
}
