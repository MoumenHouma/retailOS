import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CommissionsListQuerySchema } from "@/lib/validators/commissions";
import { listCommissions } from "@/server/services/commissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:payroll");
    const { searchParams } = new URL(request.url);
    const parsed = CommissionsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const commissions = await withTenant(session!.user.tenantId, (tx) => listCommissions(tx, parsed.data));
    return apiSuccess(commissions);
  } catch (error) {
    return mapServiceError(error);
  }
}
