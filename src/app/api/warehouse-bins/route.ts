import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateWarehouseBinSchema } from "@/lib/validators/warehousing";
import { createBin, listBins } from "@/server/services/warehouses";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get("zoneId");
    if (!zoneId) return apiSuccess([]);

    const bins = await withTenant(session!.user.tenantId, (tx) => listBins(tx, zoneId));
    return apiSuccess(bins);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:adjust");
    const body = await request.json();
    const parsed = CreateWarehouseBinSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const bin = await withTenant(session!.user.tenantId, (tx) => createBin(tx, parsed.data));
    return apiSuccess(bin, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
