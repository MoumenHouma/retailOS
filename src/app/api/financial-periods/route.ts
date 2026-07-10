import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreatePeriodSchema } from "@/lib/validators/financial-periods";
import { createPeriod, listPeriods } from "@/server/services/financial-periods";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "finance:report");
    const periods = await withTenant(session!.user.tenantId, (tx) => listPeriods(tx));
    return apiSuccess(periods);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:period");
    const body = await request.json();
    const parsed = CreatePeriodSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const period = await withTenant(session!.user.tenantId, (tx) => createPeriod(tx, parsed.data));
    return apiSuccess(period, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
