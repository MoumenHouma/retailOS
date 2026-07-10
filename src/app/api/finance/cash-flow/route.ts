import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { FinancialReportQuerySchema } from "@/lib/validators/financial-reports";
import { getCashFlowStatement } from "@/server/services/financial-reports-advanced";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = FinancialReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const cashFlow = await withTenant(session!.user.tenantId, (tx) =>
      getCashFlowStatement(tx, parsed.data),
    );
    return apiSuccess(cashFlow);
  } catch (error) {
    return mapServiceError(error);
  }
}
