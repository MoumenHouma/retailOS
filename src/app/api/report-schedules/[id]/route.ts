import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ScheduledReportUpdateSchema } from "@/lib/validators/reports";
import { updateScheduledReport, softDeleteScheduledReport } from "@/server/services/scheduled-reports";
import { registerReportSchedule, unregisterReportSchedule } from "@/server/queue/queues";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  try {
    requirePermission(session, "reports:customize");
    const { id } = await params;
    const body = await request.json();
    const parsed = ScheduledReportUpdateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const updated = await withTenant(session!.user.tenantId, (tx) => updateScheduledReport(tx, id, parsed.data));
    if (updated.isActive) {
      await registerReportSchedule(updated.id, session!.user.tenantId, updated.frequency);
    } else {
      await unregisterReportSchedule(updated.id);
    }
    return apiSuccess(updated);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  try {
    requirePermission(session, "reports:customize");
    const { id } = await params;
    await withTenant(session!.user.tenantId, (tx) => softDeleteScheduledReport(tx, id));
    await unregisterReportSchedule(id);
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
