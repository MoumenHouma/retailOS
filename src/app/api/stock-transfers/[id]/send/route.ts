import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { SendTransferSchema } from "@/lib/validators/warehousing";
import { sendTransfer } from "@/server/services/stock-transfers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:transfer");
    const body = await request.json();
    const parsed = SendTransferSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const transfer = await withTenant(session!.user.tenantId, (tx) =>
      sendTransfer(tx, id, parsed.data, session!.user.id),
    );
    return apiSuccess(transfer);
  } catch (error) {
    return mapServiceError(error);
  }
}
