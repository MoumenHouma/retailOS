import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getBalanceSheet } from "@/server/services/financial-reports-advanced";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const balanceSheet = await withTenant(session!.user.tenantId, (tx) => getBalanceSheet(tx));
    return apiSuccess(balanceSheet);
  } catch (error) {
    return mapServiceError(error);
  }
}
