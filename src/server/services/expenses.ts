import type { Prisma } from "@prisma/client";
import type { CreateExpenseInput, ExpenseSearchQuery, UpdateExpenseInput } from "@/lib/validators/expenses";

type TransactionClient = Prisma.TransactionClient;

export async function createExpense(
  tx: TransactionClient,
  input: CreateExpenseInput,
  createdBy: string,
) {
  return tx.expense.create({ data: { ...input, createdBy } });
}

export async function updateExpense(tx: TransactionClient, id: string, input: UpdateExpenseInput) {
  return tx.expense.update({ where: { id }, data: input });
}

export async function softDeleteExpense(tx: TransactionClient, id: string): Promise<void> {
  await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function searchExpenses(tx: TransactionClient, query: ExpenseSearchQuery) {
  const { storeId, categoryId, paymentMethod, from, to, page, pageSize } = query;

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(storeId ? { storeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(from || to
      ? {
          expenseDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    tx.expense.findMany({
      where,
      include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.expense.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
