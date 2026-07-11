import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { EmployeePerformanceQuerySchema } from "@/lib/validators/employee-performance";
import { getEmployeePerformance } from "@/server/services/employee-performance";
import { parseReportFormat, buildReportExportResponse } from "@/lib/report-response";
import { formatDa } from "@/lib/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "reports:view");
    const { searchParams } = new URL(request.url);
    const parsed = EmployeePerformanceQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const rows = await withTenant(session!.user.tenantId, (tx) => getEmployeePerformance(tx, parsed.data));

    const format = parseReportFormat(searchParams.get("format"));
    if (format) {
      requirePermission(session, "reports:export");
      const exportRows = rows.map((r) => ({
        Employé: `${r.firstName} ${r.lastName}`,
        Ventes: formatDa(r.salesTotal),
        "Nb ventes": r.salesCount,
        Commissions: formatDa(r.commissionTotal),
        "Taux de présence": r.attendanceRate != null ? `${Math.round(r.attendanceRate * 100)}%` : "",
      }));
      return buildReportExportResponse(
        format,
        exportRows,
        [
          { key: "Employé", label: "Employé" },
          { key: "Ventes", label: "Ventes", align: "right" },
          { key: "Nb ventes", label: "Nb ventes", align: "right" },
          { key: "Commissions", label: "Commissions", align: "right" },
          { key: "Taux de présence", label: "Présence", align: "right" },
        ],
        { title: "Performance des employés", filenameBase: "performance-employes" },
      );
    }

    return apiSuccess(rows);
  } catch (error) {
    return mapServiceError(error);
  }
}
