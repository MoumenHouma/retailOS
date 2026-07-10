import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { AttendanceListQuerySchema, CreateAttendanceSchema } from "@/lib/validators/attendance";
import { createAttendanceRecord, listAttendance } from "@/server/services/attendance";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:schedule");
    const { searchParams } = new URL(request.url);
    const parsed = AttendanceListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const records = await withTenant(session!.user.tenantId, (tx) => listAttendance(tx, parsed.data));
    return apiSuccess(records);
  } catch (error) {
    return mapServiceError(error);
  }
}

// Manual backfill entry — a forgotten clock-in is recorded after the fact
// through this same collection route rather than a separate endpoint.
export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:schedule");
    const body = await request.json();
    const parsed = CreateAttendanceSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const record = await withTenant(session!.user.tenantId, (tx) =>
      createAttendanceRecord(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(record, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
