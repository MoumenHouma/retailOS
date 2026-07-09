import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateWarehouseZoneSchema } from "@/lib/validators/warehousing";
import { createZone, listZones } from "@/server/services/warehouses";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouseId");
    if (!warehouseId) return apiSuccess([]);

    const zones = await withTenant(session!.user.tenantId, (tx) => listZones(tx, warehouseId));
    return apiSuccess(zones);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:adjust");
    const body = await request.json();
    const parsed = CreateWarehouseZoneSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const zone = await withTenant(session!.user.tenantId, (tx) => createZone(tx, parsed.data));
    return apiSuccess(zone, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
