import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { RevenueDashboardQuerySchema } from "@/lib/validators/financial-reports";
import { getRevenueDashboard } from "@/server/services/financial-reports";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = RevenueDashboardQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const buckets = await withTenant(session!.user.tenantId, (tx) =>
      getRevenueDashboard(tx, parsed.data),
    );

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = buckets.map((b) => ({
        Période: b.period,
        "Chiffre d'affaires": formatDa(b.revenue),
        TVA: formatDa(b.tvaAmount),
        Total: formatDa(b.total),
        "Nb ventes": b.saleCount,
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Période", label: "Période" },
          { key: "Chiffre d'affaires", label: "CA", align: "right" },
          { key: "TVA", label: "TVA", align: "right" },
          { key: "Total", label: "Total", align: "right" },
          { key: "Nb ventes", label: "Ventes", align: "right" },
        ],
        { title: "Tableau de bord des revenus", filenameBase: "revenus" },
      );
    }

    return apiSuccess(buckets);
  } catch (error) {
    return mapServiceError(error);
  }
}
