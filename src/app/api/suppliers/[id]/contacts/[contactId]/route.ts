import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateSupplierContactSchema } from "@/lib/validators/suppliers";
import { removeSupplierContact, updateSupplierContact } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string; contactId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id, contactId } = await params;
  try {
    requirePermission(session, "suppliers:update");
    const body = await request.json();
    const parsed = UpdateSupplierContactSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const contact = await withTenant(session!.user.tenantId, (tx) =>
      updateSupplierContact(tx, id, contactId, parsed.data),
    );
    return apiSuccess(contact);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { contactId } = await params;
  try {
    requirePermission(session, "suppliers:update");
    await withTenant(session!.user.tenantId, (tx) => removeSupplierContact(tx, contactId));
    return apiSuccess({ id: contactId });
  } catch (error) {
    return mapServiceError(error);
  }
}
