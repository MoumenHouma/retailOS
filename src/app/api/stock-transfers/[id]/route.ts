import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getTransferById } from "@/server/services/stock-transfers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:read");
    const transfer = await withTenant(session!.user.tenantId, (tx) => getTransferById(tx, id));
    return apiSuccess(transfer);
  } catch (error) {
    return mapServiceError(error);
  }
}
