import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { cancelCount } from "@/server/services/stock-counts";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:count");
    const count = await withTenant(session!.user.tenantId, (tx) => cancelCount(tx, id));
    return apiSuccess(count);
  } catch (error) {
    return mapServiceError(error);
  }
}
