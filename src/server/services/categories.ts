import type { Prisma } from "@prisma/client";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/validators/products";

type TransactionClient = Prisma.TransactionClient;

export class InvalidParentError extends Error {
  constructor() {
    super("A category cannot be its own ancestor.");
    this.name = "InvalidParentError";
  }
}

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryNode[];
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
    const parent: { parentId: string | null } | null = await tx.productCategory.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

export async function listCategoryTree(tx: TransactionClient): Promise<CategoryNode[]> {
  const categories = await tx.productCategory.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });

  const byId = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: CategoryNode[] = [];

  for (const category of byId.values()) {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(category);
    } else {
      roots.push(category);
    }
  }

  return roots;
}

export async function createCategory(tx: TransactionClient, input: CreateCategoryInput) {
  return tx.productCategory.create({
    data: {
      name: input.name,
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
      parentId: input.parentId ?? null,
    },
  });
}

export async function updateCategory(
  tx: TransactionClient,
  id: string,
  input: UpdateCategoryInput,
) {
  if (input.parentId) {
    await assertNoCycle(tx, id, input.parentId);
  }
  return tx.productCategory.update({
    where: { id },
    data: input,
  });
}

/**
 * Deletes a category, reassigning both its direct child categories and its
 * products to its own parent (or null, if it has none) so the tree never
 * orphans a subtree (ARCHITECTURE.md §4.2, extended to child categories).
 */
export async function deleteCategory(tx: TransactionClient, id: string): Promise<void> {
  const category = await tx.productCategory.findUniqueOrThrow({
    where: { id },
    select: { parentId: true },
  });

  await tx.productCategory.updateMany({
    where: { parentId: id },
    data: { parentId: category.parentId },
  });

  await tx.product.updateMany({
    where: { categoryId: id },
    data: { categoryId: category.parentId },
  });

  await tx.productCategory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
