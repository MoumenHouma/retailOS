import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateExpenseSchema } from "@/lib/validators/expenses";
import { softDeleteExpense, updateExpense } from "@/server/services/expenses";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:expense");
    const expense = await withTenant(session!.user.tenantId, (tx) =>
      tx.expense.findUniqueOrThrow({
        where: { id },
        include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
      }),
    );
    return apiSuccess(expense);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:expense");
    const body = await request.json();
    const parsed = UpdateExpenseSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const expense = await withTenant(session!.user.tenantId, (tx) =>
      updateExpense(tx, id, parsed.data),
    );
    return apiSuccess(expense);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:expense");
    await withTenant(session!.user.tenantId, (tx) => softDeleteExpense(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
