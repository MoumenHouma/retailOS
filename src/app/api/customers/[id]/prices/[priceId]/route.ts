import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { removeCustomerPrice } from "@/server/services/customer-pricing";

interface Params {
  params: Promise<{ id: string; priceId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { priceId } = await params;
  try {
    requirePermission(session, "customers:update");
    await withTenant(session!.user.tenantId, (tx) => removeCustomerPrice(tx, priceId));
    return apiSuccess({ id: priceId });
  } catch (error) {
    return mapServiceError(error);
  }
}
