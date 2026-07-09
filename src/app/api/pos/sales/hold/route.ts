import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { HoldSaleSchema } from "@/lib/validators/pos";
import { holdSale } from "@/server/services/sales";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const body = await request.json();
    const parsed = HoldSaleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const held = await withTenant(session!.user.tenantId, (tx) =>
      holdSale(tx, { ...parsed.data, cashierId: session!.user.id }),
    );
    return apiSuccess(held, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
