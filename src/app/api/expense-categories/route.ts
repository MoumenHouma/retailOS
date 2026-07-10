import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateExpenseCategorySchema } from "@/lib/validators/expense-categories";
import { createExpenseCategory, listExpenseCategoryTree } from "@/server/services/expense-categories";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "finance:expense");
    const tree = await withTenant(session!.user.tenantId, (tx) => listExpenseCategoryTree(tx));
    return apiSuccess(tree);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:expense");
    const body = await request.json();
    const parsed = CreateExpenseCategorySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const category = await withTenant(session!.user.tenantId, (tx) =>
      createExpenseCategory(tx, parsed.data),
    );
    return apiSuccess(category, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
