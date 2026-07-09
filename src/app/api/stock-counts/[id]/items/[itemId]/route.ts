import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateCountItemSchema } from "@/lib/validators/warehousing";
import { updateCountItem } from "@/server/services/stock-counts";

interface Params {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id, itemId } = await params;
  try {
    requirePermission(session, "inventory:count");
    const body = await request.json();
    const parsed = UpdateCountItemSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const item = await withTenant(session!.user.tenantId, (tx) =>
      updateCountItem(tx, id, itemId, parsed.data.countedQuantity),
    );
    return apiSuccess(item);
  } catch (error) {
    return mapServiceError(error);
  }
}
