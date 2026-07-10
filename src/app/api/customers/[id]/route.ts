import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateCustomerSchema } from "@/lib/validators/customers";
import { softDeleteCustomer, updateCustomer } from "@/server/services/customers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:read");
    const customer = await withTenant(session!.user.tenantId, (tx) =>
      tx.customer.findUniqueOrThrow({ where: { id } }),
    );
    return apiSuccess(customer);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:update");
    const body = await request.json();
    const parsed = UpdateCustomerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const customer = await withTenant(session!.user.tenantId, (tx) =>
      updateCustomer(tx, id, parsed.data),
    );
    return apiSuccess(customer);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:delete");
    await withTenant(session!.user.tenantId, (tx) => softDeleteCustomer(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
