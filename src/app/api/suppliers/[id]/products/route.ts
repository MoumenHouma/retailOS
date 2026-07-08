import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { LinkSupplierProductSchema } from "@/lib/validators/suppliers";
import { linkSupplierProduct } from "@/server/services/suppliers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "suppliers:update");
    const body = await request.json();
    const parsed = LinkSupplierProductSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const link = await withTenant(session!.user.tenantId, (tx) =>
      linkSupplierProduct(tx, id, parsed.data),
    );
    return apiSuccess(link, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
