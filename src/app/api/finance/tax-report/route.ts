import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { TaxReportQuerySchema } from "@/lib/validators/financial-reports-advanced";
import { getTaxReport } from "@/server/services/financial-reports-advanced";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = TaxReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const report = await withTenant(session!.user.tenantId, (tx) => getTaxReport(tx, parsed.data));

    // Phase 6 Chunk D follow-up: upgraded from the original csv-only
    // exportTaxReportCsv (Phase 4 Chunk C) to the shared pdf/xlsx/csv
    // pattern used across every other report — same rows, generic renderer.
    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = report.map((r) => ({
        Période: r.period,
        Collectée: formatDa(r.collected),
        "Payée (achats)": formatDa(r.paidPurchases),
        "Payée (dépenses)": formatDa(r.paidExpenses),
        "Total payé": formatDa(r.paidTotal),
        Net: formatDa(r.net),
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Période", label: "Période" },
          { key: "Collectée", label: "Collectée", align: "right" },
          { key: "Payée (achats)", label: "Payée (achats)", align: "right" },
          { key: "Payée (dépenses)", label: "Payée (dépenses)", align: "right" },
          { key: "Total payé", label: "Total payé", align: "right" },
          { key: "Net", label: "Net", align: "right" },
        ],
        { title: "Rapport TVA", filenameBase: "rapport-tva" },
      );
    }

    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
