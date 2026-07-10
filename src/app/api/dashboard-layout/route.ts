import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { DashboardLayoutUpdateSchema } from "@/lib/validators/reports";
import { getDashboardLayout, upsertDashboardLayout } from "@/server/services/dashboard-layout";

export async function GET() {
  const session = await auth();
  try {
    const role = session!.user.roles[0] ?? "BUSINESS_OWNER";
    const widgets = await withTenant(session!.user.tenantId, (tx) =>
      getDashboardLayout(tx, session!.user.tenantId, role),
    );
    return apiSuccess({ role, widgets });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "reports:customize");
    const body = await request.json();
    const parsed = DashboardLayoutUpdateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const role = session!.user.roles[0] ?? "BUSINESS_OWNER";
    const updated = await withTenant(session!.user.tenantId, (tx) =>
      upsertDashboardLayout(tx, session!.user.tenantId, role, parsed.data, session!.user.id),
    );
    return apiSuccess(updated);
  } catch (error) {
    return mapServiceError(error);
  }
}
