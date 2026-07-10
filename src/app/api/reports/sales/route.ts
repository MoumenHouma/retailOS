import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { SalesReportQuerySchema } from "@/lib/validators/reports";
import { getSalesSummaryReport } from "@/server/services/sales-report";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "reports:view");
    const { searchParams } = new URL(request.url);
    const parsed = SalesReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const report = await withTenant(session!.user.tenantId, (tx) => getSalesSummaryReport(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = report.buckets.map((b) => ({
        Période: b.period,
        "Chiffre d'affaires": formatDa(b.revenue),
        "Nb ventes": b.saleCount,
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Période", label: "Période" },
          { key: "Chiffre d'affaires", label: "CA", align: "right" },
          { key: "Nb ventes", label: "Ventes", align: "right" },
        ],
        { title: "Rapport de ventes", filenameBase: "rapport-ventes" },
      );
    }

    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
