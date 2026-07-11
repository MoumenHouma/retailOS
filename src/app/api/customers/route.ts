import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateCustomerSchema, CustomerSearchQuerySchema } from "@/lib/validators/customers";
import { createCustomer, searchCustomers } from "@/server/services/customers";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "customers:read");
    const { searchParams } = new URL(request.url);
    const parsed = CustomerSearchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchCustomers(tx, parsed.data),
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
    requirePermission(session, "customers:create");
    const body = await request.json();
    const parsed = CreateCustomerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const customer = await withTenant(session!.user.tenantId, (tx) => createCustomer(tx, parsed.data));
    return apiSuccess(customer, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
