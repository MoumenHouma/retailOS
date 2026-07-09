import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { recallSale } from "@/server/services/sales";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "pos:operate");
    const recalled = await withTenant(session!.user.tenantId, (tx) => recallSale(tx, id));
    return apiSuccess(recalled);
  } catch (error) {
    return mapServiceError(error);
  }
}
