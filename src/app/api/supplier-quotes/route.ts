import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateSupplierQuoteSchema } from "@/lib/validators/purchasing";
import { createQuote, listQuotes } from "@/server/services/supplier-quotes";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplierId") ?? undefined;

    const quotes = await withTenant(session!.user.tenantId, (tx) => listQuotes(tx, supplierId));
    return apiSuccess(quotes);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:create");
    const body = await request.json();
    const parsed = CreateSupplierQuoteSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const quote = await withTenant(session!.user.tenantId, (tx) => createQuote(tx, parsed.data));
    return apiSuccess(quote, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
