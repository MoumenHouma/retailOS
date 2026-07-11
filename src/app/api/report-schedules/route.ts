import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { isDesktopEdition, desktopNotAvailableResponse } from "@/lib/edition";
import { ScheduledReportCreateSchema } from "@/lib/validators/reports";
import { createScheduledReport, listScheduledReports } from "@/server/services/scheduled-reports";
import { registerReportSchedule } from "@/server/queue/queues";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "reports:view");
    const rows = await withTenant(session!.user.tenantId, (tx) => listScheduledReports(tx));
    return apiSuccess(rows);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  // Registers a BullMQ cron job — no Redis/worker bundled in the desktop
  // edition. The GET (list) handler above is a plain Prisma read and stays
  // available — a shop can still see previously-created schedules, it just
  // can't register new cron-driven ones without the worker.
  if (isDesktopEdition()) return desktopNotAvailableResponse();

  const session = await auth();
  try {
    requirePermission(session, "reports:customize");
    const body = await request.json();
    const parsed = ScheduledReportCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const created = await withTenant(session!.user.tenantId, (tx) =>
      createScheduledReport(tx, parsed.data, session!.user.id),
    );
    await registerReportSchedule(created.id, session!.user.tenantId, created.frequency);
    return apiSuccess(created, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
