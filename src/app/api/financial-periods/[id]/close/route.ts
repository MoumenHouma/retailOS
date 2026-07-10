import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { closePeriod } from "@/server/services/financial-periods";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:period");
    const period = await withTenant(session!.user.tenantId, (tx) =>
      closePeriod(tx, id, session!.user.id),
    );
    return apiSuccess(period);
  } catch (error) {
    return mapServiceError(error);
  }
}
