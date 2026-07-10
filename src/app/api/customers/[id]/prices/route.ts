import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { SetCustomerPriceSchema } from "@/lib/validators/customer-pricing";
import { listCustomerPrices, setCustomerPrice } from "@/server/services/customer-pricing";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:read");
    const prices = await withTenant(session!.user.tenantId, (tx) => listCustomerPrices(tx, id));
    return apiSuccess(prices);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:update");
    const body = await request.json();
    const parsed = SetCustomerPriceSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const price = await withTenant(session!.user.tenantId, (tx) =>
      setCustomerPrice(tx, { customerId: id, ...parsed.data }),
    );
    return apiSuccess(price, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
