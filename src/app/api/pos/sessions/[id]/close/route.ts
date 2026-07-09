import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CloseSessionSchema } from "@/lib/validators/pos";
import { closeSession } from "@/server/services/pos-sessions";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "pos:operate");
    const body = await request.json();
    const parsed = CloseSessionSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const closed = await withTenant(session!.user.tenantId, (tx) =>
      closeSession(tx, { sessionId: id, closingCash: parsed.data.closingCash, closedBy: session!.user.id }),
    );
    return apiSuccess(closed);
  } catch (error) {
    return mapServiceError(error);
  }
}
