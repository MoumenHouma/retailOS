import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateProductSchema, ProductSearchQuerySchema } from "@/lib/validators/products";
import { createProduct, searchProducts } from "@/server/services/products";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const { searchParams } = new URL(request.url);
    const parsed = ProductSearchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchProducts(tx, parsed.data),
    );
    const response = apiSuccess(items, { page, pageSize, total, totalPages });
    response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=60");
    return response;
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");
    const body = await request.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const product = await withTenant(session!.user.tenantId, (tx) =>
      createProduct(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(product, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
