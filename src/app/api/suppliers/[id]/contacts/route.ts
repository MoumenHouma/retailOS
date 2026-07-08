import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateSupplierContactSchema } from "@/lib/validators/suppliers";
import { addSupplierContact } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:update");
    const body = await request.json();
    const parsed = CreateSupplierContactSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const contact = await withTenant(session!.user.tenantId, (tx) =>
      addSupplierContact(tx, id, parsed.data),
    );
    return apiSuccess(contact, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
