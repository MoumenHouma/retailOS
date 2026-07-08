import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { removeBarcode, setPrimaryBarcode } from "@/server/services/barcodes";

interface Params {
  params: Promise<{ id: string; barcodeId: string }>;
}

export async function PATCH(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id, barcodeId } = await params;
  try {
    requirePermission(session, "products:update");
    await withTenant(session!.user.tenantId, (tx) => setPrimaryBarcode(tx, id, barcodeId));
    return apiSuccess({ id: barcodeId, isPrimary: true });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id, barcodeId } = await params;
  try {
    requirePermission(session, "products:update");
    await withTenant(session!.user.tenantId, (tx) => removeBarcode(tx, id, barcodeId));
    return apiSuccess({ id: barcodeId });
  } catch (error) {
    return mapServiceError(error);
  }
}
