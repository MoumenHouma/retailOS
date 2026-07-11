import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { getReorderSuggestions } from "@/server/services/procurement-reports";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const suggestions = await withTenant(session!.user.tenantId, (tx) => getReorderSuggestions(tx));

    const format = parseReportFormat(new URL(request.url).searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const rows = suggestions.map((s) => ({
        Produit: s.productName,
        Magasin: s.storeName,
        Stock: s.quantityOnHand,
        "Seuil min.": s.minStockLevel,
        Fournisseur: s.supplier?.name ?? "",
        "Qté suggérée": s.suggestedQuantity ?? "",
      }));
      return buildReportExportResponse(
        format,
        rows,
        [
          { key: "Produit", label: "Produit" },
          { key: "Magasin", label: "Magasin" },
          { key: "Stock", label: "Stock", align: "right" },
          { key: "Seuil min.", label: "Seuil min.", align: "right" },
          { key: "Fournisseur", label: "Fournisseur" },
          { key: "Qté suggérée", label: "Qté suggérée", align: "right" },
        ],
        { title: "Suggestions de réapprovisionnement", filenameBase: "reapprovisionnement" },
      );
    }

    return apiSuccess(suggestions);
  } catch (error) {
    return mapServiceError(error);
  }
}
