import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { updateStore, softDeleteStore } from "@/server/services/stores";
import { StoreUpdateSchema } from "@/lib/validators/stores";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  try {
    requirePermission(session, "stores:manage");
    const { id } = await params;
    const body = await request.json();
    const parsed = StoreUpdateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const store = await withTenant(session!.user.tenantId, (tx) => updateStore(tx, id, parsed.data));
    return apiSuccess(store);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  try {
    requirePermission(session, "stores:manage");
    const { id } = await params;
    await withTenant(session!.user.tenantId, (tx) => softDeleteStore(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
