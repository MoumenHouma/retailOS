import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateBrandSchema } from "@/lib/validators/products";
import { deleteBrand, updateBrand } from "@/server/services/brands";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:read");
    const brand = await withTenant(session!.user.tenantId, (tx) =>
      tx.brand.findUniqueOrThrow({ where: { id } }),
    );
    return apiSuccess(brand);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:update");
    const body = await request.json();
    const parsed = UpdateBrandSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const brand = await withTenant(session!.user.tenantId, (tx) => updateBrand(tx, id, parsed.data));
    return apiSuccess(brand);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:delete");
    await withTenant(session!.user.tenantId, (tx) => deleteBrand(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
