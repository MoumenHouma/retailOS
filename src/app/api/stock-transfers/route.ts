import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission, requireStoreAccess } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateStockTransferSchema, StockTransferListQuerySchema } from "@/lib/validators/warehousing";
import { createTransfer, searchTransfers } from "@/server/services/stock-transfers";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const { searchParams } = new URL(request.url);
    const parsed = StockTransferListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchTransfers(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:transfer");
    const body = await request.json();
    const parsed = CreateStockTransferSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    requireStoreAccess(session, parsed.data.fromStoreId);
    requireStoreAccess(session, parsed.data.toStoreId);

    const transfer = await withTenant(session!.user.tenantId, (tx) =>
      createTransfer(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(transfer, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
