import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreatePurchaseOrderSchema, PurchaseOrderListQuerySchema } from "@/lib/validators/purchasing";
import { createPurchaseOrder, searchPurchaseOrders } from "@/server/services/purchase-orders";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const { searchParams } = new URL(request.url);
    const parsed = PurchaseOrderListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchPurchaseOrders(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:create");
    const body = await request.json();
    const parsed = CreatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const po = await withTenant(session!.user.tenantId, (tx) =>
      createPurchaseOrder(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(po, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
