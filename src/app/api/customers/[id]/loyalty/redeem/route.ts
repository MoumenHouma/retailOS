import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { RedeemLoyaltyPointsSchema } from "@/lib/validators/loyalty";
import { redeemPoints } from "@/server/services/loyalty";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "customers:update");
    const body = await request.json();
    const parsed = RedeemLoyaltyPointsSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const transaction = await withTenant(session!.user.tenantId, (tx) =>
      redeemPoints(tx, { customerId: id, points: parsed.data.points, reason: parsed.data.reason }),
    );
    return apiSuccess(transaction, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
