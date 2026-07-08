import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateCategorySchema } from "@/lib/validators/products";
import { createCategory, listCategoryTree } from "@/server/services/categories";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const tree = await withTenant(session!.user.tenantId, (tx) => listCategoryTree(tx));
    return apiSuccess(tree);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");
    const body = await request.json();
    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const category = await withTenant(session!.user.tenantId, (tx) =>
      createCategory(tx, parsed.data),
    );
    return apiSuccess(category, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
