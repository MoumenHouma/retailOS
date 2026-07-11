import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { FinancialReportQuerySchema } from "@/lib/validators/financial-reports";
import { getCashFlowStatement } from "@/server/services/financial-reports-advanced";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

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

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const row = {
        "Entrées de trésorerie": formatDa(cashFlow.cashIn.total),
        "Sorties de trésorerie": formatDa(cashFlow.cashOut.total),
        "Flux net": formatDa(cashFlow.netCashFlow),
        "Achats en engagement": formatDa(cashFlow.purchasesAccrual),
      };
      return buildReportExportResponse(
        format,
        [row],
        Object.keys(row).map((key) => ({ key, label: key })),
        { title: "Flux de trésorerie", filenameBase: "flux-de-tresorerie" },
      );
    }

    return apiSuccess(cashFlow);
  } catch (error) {
    return mapServiceError(error);
  }
}
