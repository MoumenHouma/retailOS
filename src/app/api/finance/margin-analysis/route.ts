import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { MarginAnalysisQuerySchema } from "@/lib/validators/financial-reports-advanced";
import { getMarginAnalysis } from "@/server/services/financial-reports-advanced";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = MarginAnalysisQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const analysis = await withTenant(session!.user.tenantId, (tx) => getMarginAnalysis(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = analysis.map((a) => ({
        Élément: a.label,
        Quantité: a.quantity,
        "Chiffre d'affaires": formatDa(a.revenue),
        Marge: formatDa(a.margin),
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Élément", label: "Élément" },
          { key: "Quantité", label: "Quantité", align: "right" },
          { key: "Chiffre d'affaires", label: "CA", align: "right" },
          { key: "Marge", label: "Marge", align: "right" },
        ],
        { title: "Analyse de marge", filenameBase: "analyse-marge" },
      );
    }

    return apiSuccess(analysis);
  } catch (error) {
    return mapServiceError(error);
  }
}
