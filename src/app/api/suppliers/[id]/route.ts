import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateSupplierSchema } from "@/lib/validators/suppliers";
import { softDeleteSupplier, updateSupplier } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:read");
    const supplier = await withTenant(session!.user.tenantId, (tx) =>
      tx.supplier.findUniqueOrThrow({
        where: { id },
        include: { contacts: true },
      }),
    );
    return apiSuccess(supplier);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:update");
    const body = await request.json();
    const parsed = UpdateSupplierSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const supplier = await withTenant(session!.user.tenantId, (tx) =>
      updateSupplier(tx, id, parsed.data),
    );
    return apiSuccess(supplier);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:delete");
    await withTenant(session!.user.tenantId, (tx) => softDeleteSupplier(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
