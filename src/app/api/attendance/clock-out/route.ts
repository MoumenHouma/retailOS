import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ClockOutSchema } from "@/lib/validators/attendance";
import { clockOut } from "@/server/services/attendance";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:schedule");
    const body = await request.json();
    const parsed = ClockOutSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const record = await withTenant(session!.user.tenantId, (tx) => clockOut(tx, parsed.data.recordId));
    return apiSuccess(record);
  } catch (error) {
    return mapServiceError(error);
  }
}
