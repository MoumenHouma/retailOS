import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateExpenseCategorySchema } from "@/lib/validators/expense-categories";
import { deactivateExpenseCategory, updateExpenseCategory } from "@/server/services/expense-categories";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:expense");
    const body = await request.json();
    const parsed = UpdateExpenseCategorySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const category = await withTenant(session!.user.tenantId, (tx) =>
      updateExpenseCategory(tx, id, parsed.data),
    );
    return apiSuccess(category);
  } catch (error) {
    return mapServiceError(error);
  }
}

// No hard delete / soft-delete here — this model has no deletedAt
// (DATABASE.md §9.4 is isActive-only, see expense-categories.ts). DELETE
// deactivates instead so existing Expense.categoryId references never
// dangle.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:expense");
    await withTenant(session!.user.tenantId, (tx) => deactivateExpenseCategory(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
