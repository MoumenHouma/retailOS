import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ProductCatalogSyncQuerySchema } from "@/lib/validators/products";
import { getProductCatalogSync } from "@/server/services/products";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const { searchParams } = new URL(request.url);
    const parsed = ProductCatalogSyncQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    // Captured before the query runs, so it becomes a safe watermark for the
    // caller's *next* sync — anything committed while this query is still
    // running has an updatedAt >= this instant and will be picked up next
    // time rather than silently skipped.
    const syncedAt = new Date();
    const items = await withTenant(session!.user.tenantId, (tx) =>
      getProductCatalogSync(tx, parsed.data),
    );
    return apiSuccess({ items, syncedAt: syncedAt.toISOString() });
  } catch (error) {
    return mapServiceError(error);
  }
}
