import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ReceiveDeliverySchema } from "@/lib/validators/purchasing";
import { listDeliveries, receiveDelivery } from "@/server/services/purchase-deliveries";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:read");
    const deliveries = await withTenant(session!.user.tenantId, (tx) => listDeliveries(tx, id));
    return apiSuccess(deliveries);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "purchases:create");
    const body = await request.json();
    const parsed = ReceiveDeliverySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const delivery = await withTenant(session!.user.tenantId, (tx) =>
      receiveDelivery(tx, id, parsed.data, session!.user.id),
    );
    return apiSuccess(delivery, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
