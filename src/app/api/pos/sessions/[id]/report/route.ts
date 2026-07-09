import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getSessionReport } from "@/server/services/pos-sessions";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "pos:operate");
    const report = await withTenant(session!.user.tenantId, (tx) => getSessionReport(tx, id));
    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
