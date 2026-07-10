import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getSupplierScoreHistory } from "@/server/services/supplier-mcda";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:read");

    const result = await withTenant(session!.user.tenantId, async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, rating: true },
      });
      const history = await getSupplierScoreHistory(tx, { supplierId: id });
      return { supplier, history };
    });
    return apiSuccess(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
