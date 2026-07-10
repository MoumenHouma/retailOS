import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateShiftSchema } from "@/lib/validators/work-shifts";
import { cancelShift, updateShift } from "@/server/services/work-shifts";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:schedule");
    const body = await request.json();
    const parsed = UpdateShiftSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const shift = await withTenant(session!.user.tenantId, (tx) => updateShift(tx, id, parsed.data));
    return apiSuccess(shift);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:schedule");
    const shift = await withTenant(session!.user.tenantId, (tx) => cancelShift(tx, id));
    return apiSuccess(shift);
  } catch (error) {
    return mapServiceError(error);
  }
}
