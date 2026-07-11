import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission, requireStoreAccess } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ReceiveTransferSchema } from "@/lib/validators/warehousing";
import { receiveTransfer, getTransferById } from "@/server/services/stock-transfers";
import { invalidateStockCache } from "@/server/services/stock";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:transfer");
    const body = await request.json();
    const parsed = ReceiveTransferSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const transfer = await withTenant(session!.user.tenantId, async (tx) => {
      // Receiving adds stock to the destination store — only a user
      // assigned to that store (or BUSINESS_OWNER) may do it.
      const existing = await getTransferById(tx, id);
      requireStoreAccess(session, existing.toStoreId);
      return receiveTransfer(tx, id, parsed.data, session!.user.id);
    });
    invalidateStockCache(session!.user.tenantId);
    return apiSuccess(transfer);
  } catch (error) {
    return mapServiceError(error);
  }
}
