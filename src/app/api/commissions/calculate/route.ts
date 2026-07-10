import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CalculateCommissionsSchema } from "@/lib/validators/commissions";
import { calculateCommissionsForPeriod } from "@/server/services/commissions";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:payroll");
    const body = await request.json();
    const parsed = CalculateCommissionsSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await withTenant(session!.user.tenantId, (tx) =>
      calculateCommissionsForPeriod(tx, parsed.data),
    );
    return apiSuccess(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
