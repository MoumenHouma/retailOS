import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { AddBarcodeSchema } from "@/lib/validators/products";
import { addBarcode } from "@/server/services/barcodes";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:read");
    const barcodes = await withTenant(session!.user.tenantId, (tx) =>
      tx.productBarcode.findMany({ where: { productId: id, deletedAt: null } }),
    );
    return apiSuccess(barcodes);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "products:update");
    const body = await request.json();
    const parsed = AddBarcodeSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const barcode = await withTenant(session!.user.tenantId, (tx) =>
      addBarcode(tx, id, parsed.data),
    );
    return apiSuccess(barcode, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
