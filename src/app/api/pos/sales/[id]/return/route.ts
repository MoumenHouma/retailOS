import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateReturnSchema } from "@/lib/validators/pos";
import { createReturn } from "@/server/services/returns";
import { invalidateStockCache } from "@/server/services/stock";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "pos:refund");
    const body = await request.json();
    const parsed = CreateReturnSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const saleReturn = await withTenant(session!.user.tenantId, (tx) =>
      createReturn(tx, { ...parsed.data, originalSaleId: id, createdBy: session!.user.id }),
    );
    invalidateStockCache(session!.user.tenantId);
    return apiSuccess(saleReturn, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
