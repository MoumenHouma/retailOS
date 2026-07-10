import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { listLoyaltyTransactions } from "@/server/services/loyalty";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:read");
    const transactions = await withTenant(session!.user.tenantId, (tx) =>
      listLoyaltyTransactions(tx, id),
    );
    return apiSuccess(transactions);
  } catch (error) {
    return mapServiceError(error);
  }
}
