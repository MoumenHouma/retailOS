import type { Prisma } from "@prisma/client";
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from "@/lib/validators/expense-categories";

type TransactionClient = Prisma.TransactionClient;

export class InvalidParentError extends Error {
  constructor() {
    super("A category cannot be its own ancestor.");
    this.name = "InvalidParentError";
  }
}

interface ExpenseCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  children: ExpenseCategoryNode[];
}

async function assertNoCycle(
  tx: TransactionClient,
  categoryId: string,
  parentId: string,
): Promise<void> {
  let current: string | null = parentId;
  while (current) {
    if (current === categoryId) {
      throw new InvalidParentError();
    }
    const parent: { parentId: string | null } | null = await tx.expenseCategory.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

export async function listExpenseCategoryTree(tx: TransactionClient): Promise<ExpenseCategoryNode[]> {
  const categories = await tx.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, isActive: true },
  });

  const byId = new Map<string, ExpenseCategoryNode>(
    categories.map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: ExpenseCategoryNode[] = [];

  for (const category of byId.values()) {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(category);
    } else {
      roots.push(category);
    }
  }

  return roots;
}

export async function createExpenseCategory(
  tx: TransactionClient,
  input: CreateExpenseCategoryInput,
) {
  return tx.expenseCategory.create({ data: input });
}

export async function updateExpenseCategory(
  tx: TransactionClient,
  id: string,
  input: UpdateExpenseCategoryInput,
) {
  if (input.parentId) {
    await assertNoCycle(tx, id, input.parentId);
  }
  return tx.expenseCategory.update({ where: { id }, data: input });
}

// No deletedAt on this model (DATABASE.md §9.4 is isActive-only) — the row
// stays in place so existing Expense.categoryId references never dangle,
// unlike ProductCategory's delete which reassigns children/products up.
export async function deactivateExpenseCategory(tx: TransactionClient, id: string) {
  return tx.expenseCategory.update({ where: { id }, data: { isActive: false } });
}
