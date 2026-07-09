import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CashMovementSchema } from "@/lib/validators/pos";
import { recordCashMovement } from "@/server/services/pos-sessions";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "pos:open_drawer");
    const body = await request.json();
    const parsed = CashMovementSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const movement = await withTenant(session!.user.tenantId, (tx) =>
      recordCashMovement(tx, { sessionId: id, ...parsed.data, createdBy: session!.user.id }),
    );
    return apiSuccess(movement, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
