import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { submitForApproval } from "@/server/services/purchase-orders";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:create");
    const po = await withTenant(session!.user.tenantId, (tx) => submitForApproval(tx, id));
    return apiSuccess(po);
  } catch (error) {
    return mapServiceError(error);
  }
}
