import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateWarehouseSchema } from "@/lib/validators/warehousing";
import { createWarehouse, listWarehouses } from "@/server/services/warehouses";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId") ?? undefined;

    const warehouses = await withTenant(session!.user.tenantId, (tx) => listWarehouses(tx, storeId));
    return apiSuccess(warehouses);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "inventory:adjust");
    const body = await request.json();
    const parsed = CreateWarehouseSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const warehouse = await withTenant(session!.user.tenantId, (tx) => createWarehouse(tx, parsed.data));
    return apiSuccess(warehouse, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
