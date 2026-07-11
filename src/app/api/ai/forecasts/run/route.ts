import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { isDesktopEdition, desktopNotAvailableResponse } from "@/lib/edition";
import { TriggerForecastSchema } from "@/lib/validators/ai";
import { triggerForecastRun } from "@/server/services/forecasting";

export async function POST(request: NextRequest) {
  // Enqueues a BullMQ job — no Redis/worker/python-ai bundled in the
  // desktop edition, so this would otherwise hang trying to connect.
  if (isDesktopEdition()) return desktopNotAvailableResponse();

  const session = await auth();
  try {
    requirePermission(session, "ai:run_forecast");
    const body = await request.json();
    const parsed = TriggerForecastSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await withTenant(session!.user.tenantId, (tx) =>
      triggerForecastRun(tx, session!.user.tenantId, parsed.data),
    );
    return apiSuccess(result, undefined, 202);
  } catch (error) {
    return mapServiceError(error);
  }
}
