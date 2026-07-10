import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission, requireStoreAccess } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { SendTransferSchema } from "@/lib/validators/warehousing";
import { sendTransfer, getTransferById } from "@/server/services/stock-transfers";

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

    const transfer = await withTenant(session!.user.tenantId, async (tx) => {
      // Sending removes stock from the source store — only a user assigned
      // to that store (or BUSINESS_OWNER) may do it.
      const existing = await getTransferById(tx, id);
      requireStoreAccess(session, existing.fromStoreId);
      return sendTransfer(tx, id, parsed.data, session!.user.id);
    });
    return apiSuccess(transfer);
  } catch (error) {
    return mapServiceError(error);
  }
}
