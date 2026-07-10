import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateShiftSchema, ShiftListQuerySchema } from "@/lib/validators/work-shifts";
import { createShift, listShifts } from "@/server/services/work-shifts";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:schedule");
    const { searchParams } = new URL(request.url);
    const parsed = ShiftListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const shifts = await withTenant(session!.user.tenantId, (tx) => listShifts(tx, parsed.data));
    return apiSuccess(shifts);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:schedule");
    const body = await request.json();
    const parsed = CreateShiftSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const shift = await withTenant(session!.user.tenantId, (tx) =>
      createShift(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(shift, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
