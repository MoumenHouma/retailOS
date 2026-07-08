import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateCategorySchema } from "@/lib/validators/products";
import { deleteCategory, updateCategory } from "@/server/services/categories";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:read");
    const category = await withTenant(session!.user.tenantId, (tx) =>
      tx.productCategory.findUniqueOrThrow({ where: { id } }),
    );
    return apiSuccess(category);
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
    const parsed = UpdateCategorySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const category = await withTenant(session!.user.tenantId, (tx) =>
      updateCategory(tx, id, parsed.data),
    );
    return apiSuccess(category);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:delete");
    await withTenant(session!.user.tenantId, (tx) => deleteCategory(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
