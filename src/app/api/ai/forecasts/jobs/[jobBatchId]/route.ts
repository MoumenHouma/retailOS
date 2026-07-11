import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { isDesktopEdition, desktopNotAvailableResponse } from "@/lib/edition";
import { getForecastBatchStatus } from "@/server/services/forecasting";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobBatchId: string }> },
) {
  // Reads BullMQ job state — no Redis bundled in the desktop edition.
  if (isDesktopEdition()) return desktopNotAvailableResponse();

  const session = await auth();
  try {
    requirePermission(session, "ai:view_recommendations");
    const { jobBatchId } = await params;
    const status = await getForecastBatchStatus(session!.user.tenantId, jobBatchId);
    return apiSuccess(status);
  } catch (error) {
    return mapServiceError(error);
  }
}
