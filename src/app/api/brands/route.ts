import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateBrandSchema } from "@/lib/validators/products";
import { createBrand, listBrands } from "@/server/services/brands";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");

    const { items, total } = await withTenant(session!.user.tenantId, (tx) =>
      listBrands(tx, { q, page, pageSize }),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");
    const body = await request.json();
    const parsed = CreateBrandSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const brand = await withTenant(session!.user.tenantId, (tx) => createBrand(tx, parsed.data));
    return apiSuccess(brand, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
