import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateStockCountSchema, StockCountListQuerySchema } from "@/lib/validators/warehousing";
import { createStockCount, searchStockCounts } from "@/server/services/stock-counts";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const { searchParams } = new URL(request.url);
    const parsed = StockCountListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchStockCounts(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:count");
    const body = await request.json();
    const parsed = CreateStockCountSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const count = await withTenant(session!.user.tenantId, (tx) =>
      createStockCount(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(count, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
