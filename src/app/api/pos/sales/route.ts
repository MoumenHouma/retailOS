import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CompleteSaleSchema, SaleHistoryQuerySchema } from "@/lib/validators/pos";
import { completeSale, searchSales } from "@/server/services/sales";
import { invalidateStockCache } from "@/server/services/stock";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const { searchParams } = new URL(request.url);
    const parsed = SaleHistoryQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchSales(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const body = await request.json();
    const parsed = CompleteSaleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const hasDiscount =
      (parsed.data.discountAmount ?? 0) > 0 ||
      parsed.data.items.some((item) => (item.discountAmount ?? 0) > 0);
    if (hasDiscount) requirePermission(session, "pos:discount");

    const sale = await withTenant(session!.user.tenantId, (tx) =>
      completeSale(tx, { ...parsed.data, cashierId: session!.user.id }),
    );
    invalidateStockCache(session!.user.tenantId);
    return apiSuccess(sale, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
