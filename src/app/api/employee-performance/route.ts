import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { EmployeePerformanceQuerySchema } from "@/lib/validators/employee-performance";
import { getEmployeePerformance } from "@/server/services/employee-performance";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "reports:view");
    const { searchParams } = new URL(request.url);
    const parsed = EmployeePerformanceQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const rows = await withTenant(session!.user.tenantId, (tx) => getEmployeePerformance(tx, parsed.data));
    return apiSuccess(rows);
  } catch (error) {
    return mapServiceError(error);
  }
}
