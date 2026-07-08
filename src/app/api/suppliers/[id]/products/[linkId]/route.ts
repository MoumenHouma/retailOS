import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateSupplierProductSchema } from "@/lib/validators/suppliers";
import { removeSupplierProduct, updateSupplierProduct } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string; linkId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { linkId } = await params;
  try {
    requirePermission(session, "suppliers:update");
    const body = await request.json();
    const parsed = UpdateSupplierProductSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const link = await withTenant(session!.user.tenantId, (tx) =>
      updateSupplierProduct(tx, linkId, parsed.data),
    );
    return apiSuccess(link);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { linkId } = await params;
  try {
    requirePermission(session, "suppliers:update");
    await withTenant(session!.user.tenantId, (tx) => removeSupplierProduct(tx, linkId));
    return apiSuccess({ id: linkId });
  } catch (error) {
    return mapServiceError(error);
  }
}
