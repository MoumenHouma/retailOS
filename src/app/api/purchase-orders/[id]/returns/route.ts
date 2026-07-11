import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreatePurchaseReturnSchema } from "@/lib/validators/purchasing";
import { createPurchaseReturn, listPurchaseReturns } from "@/server/services/purchase-returns";
import { invalidateStockCache } from "@/server/services/stock";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:read");
    const returns = await withTenant(session!.user.tenantId, (tx) => listPurchaseReturns(tx, id));
    return apiSuccess(returns);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:create");
    const body = await request.json();
    const parsed = CreatePurchaseReturnSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const purchaseReturn = await withTenant(session!.user.tenantId, (tx) =>
      createPurchaseReturn(tx, id, parsed.data, session!.user.id),
    );
    invalidateStockCache(session!.user.tenantId);
    return apiSuccess(purchaseReturn, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
