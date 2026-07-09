import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateWarehouseZoneSchema } from "@/lib/validators/warehousing";
import { deleteZone, updateZone } from "@/server/services/warehouses";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:adjust");
    const body = await request.json();
    const parsed = UpdateWarehouseZoneSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const zone = await withTenant(session!.user.tenantId, (tx) => updateZone(tx, id, parsed.data));
    return apiSuccess(zone);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "inventory:adjust");
    await withTenant(session!.user.tenantId, (tx) => deleteZone(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
