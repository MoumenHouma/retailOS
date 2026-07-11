import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getPurchaseAnalytics } from "@/server/services/procurement-reports";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const analytics = await withTenant(session!.user.tenantId, (tx) => getPurchaseAnalytics(tx));

    const format = parseReportFormat(new URL(request.url).searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      // Two independent groupings — exported as one combined sheet/PDF,
      // supplier rows first then category rows, same "single export per
      // report page" convention every other retrofitted route follows.
      const rows = [
        ...analytics.bySupplier.map((s) => ({ Type: "Fournisseur", Nom: s.supplierName, Montant: formatDa(s.total) })),
        ...analytics.byCategory.map((c) => ({ Type: "Catégorie", Nom: c.categoryName, Montant: formatDa(c.total) })),
      ];
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Type", label: "Type" },
          { key: "Nom", label: "Nom" },
          { key: "Montant", label: "Montant", align: "right" },
        ],
        { title: "Analyse des achats", filenameBase: "analyse-achats" },
      );
    }

    return apiSuccess(analytics);
  } catch (error) {
    return mapServiceError(error);
  }
}
