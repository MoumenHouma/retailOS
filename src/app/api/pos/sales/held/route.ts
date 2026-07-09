import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listHeldSales } from "@/server/services/sales";
import { z } from "zod";

const HeldSalesQuerySchema = z.object({ storeId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const { searchParams } = new URL(request.url);
    const parsed = HeldSalesQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const held = await withTenant(session!.user.tenantId, (tx) =>
      listHeldSales(tx, parsed.data.storeId),
    );
    return apiSuccess(held);
  } catch (error) {
    return mapServiceError(error);
  }
}
