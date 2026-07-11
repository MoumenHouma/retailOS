import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { FinancialReportQuerySchema } from "@/lib/validators/financial-reports";
import { getProfitAndLoss } from "@/server/services/financial-reports";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = FinancialReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const report = await withTenant(session!.user.tenantId, (tx) => getProfitAndLoss(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const row = {
        "Chiffre d'affaires": formatDa(report.revenue),
        "Coût des ventes": formatDa(report.cogs),
        "Marge brute": formatDa(report.grossMargin),
        "Dépenses d'exploitation": formatDa(report.operatingExpenses),
        "Résultat net": formatDa(report.netProfit),
      };
      return buildReportExportResponse(
        format,
        [row],
        Object.keys(row).map((key) => ({ key, label: key })),
        { title: "Compte de résultat", filenameBase: "compte-de-resultat" },
      );
    }

    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
