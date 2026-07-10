import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { InventoryReportQuerySchema } from "@/lib/validators/reports";
import { getInventoryStatusReport } from "@/server/services/inventory-report";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "reports:view");
    const { searchParams } = new URL(request.url);
    const parsed = InventoryReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const report = await withTenant(session!.user.tenantId, (tx) => getInventoryStatusReport(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = report.rows.map((r) => ({
        Produit: r.productName,
        Magasin: r.storeName,
        Stock: r.quantityOnHand,
        Valeur: formatDa(r.stockValue),
        "Stock bas": r.isLowStock ? "Oui" : "Non",
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Produit", label: "Produit" },
          { key: "Magasin", label: "Magasin" },
          { key: "Stock", label: "Stock", align: "right" },
          { key: "Valeur", label: "Valeur", align: "right" },
          { key: "Stock bas", label: "Stock bas" },
        ],
        { title: "Rapport d'inventaire", filenameBase: "rapport-inventaire" },
      );
    }

    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
