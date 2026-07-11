import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { FinancialReportQuerySchema } from "@/lib/validators/financial-reports";
import { getExpenseAnalysis } from "@/server/services/financial-reports-advanced";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const parsed = FinancialReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const analysis = await withTenant(session!.user.tenantId, (tx) => getExpenseAnalysis(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = analysis.map((a) => ({
        Catégorie: a.categoryName,
        "Montant propre": formatDa(a.ownAmount),
        "Montant total": formatDa(a.totalAmount),
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Catégorie", label: "Catégorie" },
          { key: "Montant propre", label: "Montant propre", align: "right" },
          { key: "Montant total", label: "Montant total", align: "right" },
        ],
        { title: "Analyse des dépenses", filenameBase: "analyse-depenses" },
      );
    }

    return apiSuccess(analysis);
  } catch (error) {
    return mapServiceError(error);
  }
}
