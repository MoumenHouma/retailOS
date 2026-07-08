import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getSupplierPerformance } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:read");
    const performance = await withTenant(session!.user.tenantId, (tx) =>
      getSupplierPerformance(tx, id),
    );
    return apiSuccess(performance);
  } catch (error) {
    return mapServiceError(error);
  }
}
