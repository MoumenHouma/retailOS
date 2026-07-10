import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listStores, createStore } from "@/server/services/stores";
import { StoreCreateSchema } from "@/lib/validators/stores";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "inventory:read");
    const stores = await withTenant(session!.user.tenantId, (tx) => listStores(tx));
    return apiSuccess(stores);
  } catch (error) {
    return mapServiceError(error);
  }
}

// Phase 6 Chunk C: the previously-flagged gap ("no POST /api/stores route
// exists — multi-store setup has no in-app path yet," Phase 3 Chunk C's own
// Dev Log note) — closed here.
export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "stores:create");
    const body = await request.json();
    const parsed = StoreCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const store = await withTenant(session!.user.tenantId, (tx) =>
      createStore(tx, session!.user.tenantId, parsed.data),
    );
    return apiSuccess(store, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
