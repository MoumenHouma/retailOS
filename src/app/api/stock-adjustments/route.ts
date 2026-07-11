import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { StockAdjustmentSchema } from "@/lib/validators/inventory";
import { adjustStock, invalidateStockCache } from "@/server/services/stock";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:adjust");
    const body = await request.json();
    const parsed = StockAdjustmentSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const movement = await withTenant(session!.user.tenantId, (tx) =>
      adjustStock(tx, { ...parsed.data, userId: session!.user.id }),
    );
    invalidateStockCache(session!.user.tenantId);
    return apiSuccess(movement, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
