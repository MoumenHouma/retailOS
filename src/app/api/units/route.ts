import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateUnitSchema } from "@/lib/validators/products";
import { createUnit, listUnits } from "@/server/services/units";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const units = await withTenant(session!.user.tenantId, (tx) => listUnits(tx));
    return apiSuccess(units);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");
    const body = await request.json();
    const parsed = CreateUnitSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const unit = await withTenant(session!.user.tenantId, (tx) => createUnit(tx, parsed.data));
    return apiSuccess(unit, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
