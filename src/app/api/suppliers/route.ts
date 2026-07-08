import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateSupplierSchema, SupplierSearchQuerySchema } from "@/lib/validators/suppliers";
import { createSupplier, searchSuppliers } from "@/server/services/suppliers";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "suppliers:read");
    const { searchParams } = new URL(request.url);
    const parsed = SupplierSearchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchSuppliers(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "suppliers:create");
    const body = await request.json();
    const parsed = CreateSupplierSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const supplier = await withTenant(session!.user.tenantId, (tx) =>
      createSupplier(tx, parsed.data),
    );
    return apiSuccess(supplier, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
