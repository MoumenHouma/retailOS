import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getDeliveryPerformance } from "@/server/services/procurement-reports";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const performance = await withTenant(session!.user.tenantId, (tx) => getDeliveryPerformance(tx));

    const format = parseReportFormat(new URL(request.url).searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = performance.map((p) => ({
        Fournisseur: p.supplierName,
        "Livraisons à temps": p.onTimeCount,
        "Total livraisons": p.totalCount,
        "Taux à temps": `${Math.round(p.onTimeRate * 100)}%`,
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Fournisseur", label: "Fournisseur" },
          { key: "Livraisons à temps", label: "À temps", align: "right" },
          { key: "Total livraisons", label: "Total", align: "right" },
          { key: "Taux à temps", label: "Taux", align: "right" },
        ],
        { title: "Performance des livraisons", filenameBase: "performance-livraisons" },
      );
    }

    return apiSuccess(performance);
  } catch (error) {
    return mapServiceError(error);
  }
}
