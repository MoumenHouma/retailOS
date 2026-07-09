import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdatePurchaseOrderSchema } from "@/lib/validators/purchasing";
import { getPurchaseOrderById, updatePurchaseOrder } from "@/server/services/purchase-orders";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:read");
    const po = await withTenant(session!.user.tenantId, (tx) => getPurchaseOrderById(tx, id));
    return apiSuccess(po);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:create");
    const body = await request.json();
    const parsed = UpdatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const po = await withTenant(session!.user.tenantId, (tx) => updatePurchaseOrder(tx, id, parsed.data));
    return apiSuccess(po);
  } catch (error) {
    return mapServiceError(error);
  }
}
