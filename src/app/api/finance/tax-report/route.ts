import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { TaxReportQuerySchema } from "@/lib/validators/financial-reports-advanced";
import { exportTaxReportCsv, getTaxReport } from "@/server/services/financial-reports-advanced";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "json";
    const parsed = TaxReportQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    if (format === "csv") {
      requirePermission(session, "reports:export");
      const buffer = await withTenant(session!.user.tenantId, (tx) => exportTaxReportCsv(tx, parsed.data));
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="rapport-tva.csv"`,
        },
      });
    }

    const report = await withTenant(session!.user.tenantId, (tx) => getTaxReport(tx, parsed.data));
    return apiSuccess(report);
  } catch (error) {
    return mapServiceError(error);
  }
}
