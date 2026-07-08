import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateUnitSchema } from "@/lib/validators/products";
import { deleteUnit, updateUnit } from "@/server/services/units";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:read");
    const unit = await withTenant(session!.user.tenantId, (tx) =>
      tx.unit.findUniqueOrThrow({ where: { id } }),
    );
    return apiSuccess(unit);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:update");
    const body = await request.json();
    const parsed = UpdateUnitSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const unit = await withTenant(session!.user.tenantId, (tx) => updateUnit(tx, id, parsed.data));
    return apiSuccess(unit);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:delete");
    await withTenant(session!.user.tenantId, (tx) => deleteUnit(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
