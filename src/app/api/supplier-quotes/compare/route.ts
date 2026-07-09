import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { QuoteCompareQuerySchema } from "@/lib/validators/purchasing";
import { compareQuotes } from "@/server/services/supplier-quotes";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "purchases:read");
    const { searchParams } = new URL(request.url);
    const parsed = QuoteCompareQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const quotes = await withTenant(session!.user.tenantId, (tx) =>
      compareQuotes(tx, parsed.data.productIds),
    );
    return apiSuccess(quotes);
  } catch (error) {
    return mapServiceError(error);
  }
}
