import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateProductSchema } from "@/lib/validators/products";
import { softDeleteProduct, updateProduct } from "@/server/services/products";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:read");
    const product = await withTenant(session!.user.tenantId, (tx) =>
      tx.product.findUniqueOrThrow({
        where: { id },
        include: { category: true, brand: true, unit: true, barcodes: { where: { deletedAt: null } } },
      }),
    );
    return apiSuccess(product);
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
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const product = await withTenant(session!.user.tenantId, (tx) =>
      updateProduct(tx, id, parsed.data, session!.user.id),
    );
    return apiSuccess(product);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:delete");
    await withTenant(session!.user.tenantId, (tx) => softDeleteProduct(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
