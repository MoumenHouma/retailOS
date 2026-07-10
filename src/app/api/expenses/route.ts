import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateExpenseSchema, ExpenseSearchQuerySchema } from "@/lib/validators/expenses";
import { createExpense, searchExpenses } from "@/server/services/expenses";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:expense");
    const { searchParams } = new URL(request.url);
    const parsed = ExpenseSearchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchExpenses(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:expense");
    const body = await request.json();
    const parsed = CreateExpenseSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const expense = await withTenant(session!.user.tenantId, (tx) =>
      createExpense(tx, parsed.data, session!.user.id),
    );
    return apiSuccess(expense, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
