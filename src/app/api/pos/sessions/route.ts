import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { OpenSessionSchema } from "@/lib/validators/pos";
import { getCurrentSession, openSession } from "@/server/services/pos-sessions";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId") ?? session!.user.storeId;
    if (!storeId) return apiSuccess(null);

    const current = await withTenant(session!.user.tenantId, (tx) =>
      getCurrentSession(tx, storeId, session!.user.id),
    );
    return apiSuccess(current);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "pos:operate");
    const body = await request.json();
    const parsed = OpenSessionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const opened = await withTenant(session!.user.tenantId, (tx) =>
      openSession(tx, { ...parsed.data, cashierId: session!.user.id }),
    );
    return apiSuccess(opened, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
