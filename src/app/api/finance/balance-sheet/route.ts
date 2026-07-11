import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getBalanceSheet } from "@/server/services/financial-reports-advanced";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const balanceSheet = await withTenant(session!.user.tenantId, (tx) => getBalanceSheet(tx));

    const format = parseReportFormat(new URL(request.url).searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const row = {
        Trésorerie: formatDa(balanceSheet.assets.cash),
        "Créances clients": formatDa(balanceSheet.assets.accountsReceivable),
        "Valeur du stock": formatDa(balanceSheet.assets.inventoryValue),
        "Total actif": formatDa(balanceSheet.assets.total),
        "Total passif": formatDa(balanceSheet.liabilities.total),
        "Capitaux propres": formatDa(balanceSheet.equity),
      };
      return buildReportExportResponse(
        format,
        [row],
        Object.keys(row).map((key) => ({ key, label: key })),
        { title: "Bilan", filenameBase: "bilan" },
      );
    }

    return apiSuccess(balanceSheet);
  } catch (error) {
    return mapServiceError(error);
  }
}
