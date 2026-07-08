import type { Prisma } from "@prisma/client";
import type {
  BulkProductActionInput,
  CreateProductInput,
  ProductSearchQuery,
  UpdateProductInput,
} from "@/lib/validators/products";
import { addBarcode } from "./barcodes";

type TransactionClient = Prisma.TransactionClient;

export class InvalidReferenceError extends Error {
  constructor(field: string) {
    super(`${field} does not exist or does not belong to this tenant.`);
    this.name = "InvalidReferenceError";
  }
}

/**
 * Postgres foreign-key constraint checks run with the referenced table
 * owner's privileges and can bypass RLS — so a FK alone can't be trusted to
 * reject another tenant's id. Explicitly SELECT (which *is* RLS-filtered)
 * to confirm cross-tenant references are actually rejected.
 */
async function assertBelongsToTenant(
  tx: TransactionClient,
  model: "unit" | "productCategory" | "brand",
  id: string,
): Promise<void> {
  const found = await (tx[model] as { findUnique: (args: unknown) => Promise<unknown> }).findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) {
    throw new InvalidReferenceError(model);
  }
}

export async function createProduct(
  tx: TransactionClient,
  input: CreateProductInput,
  userId: string,
) {
  await assertBelongsToTenant(tx, "unit", input.unitId);
  if (input.categoryId) await assertBelongsToTenant(tx, "productCategory", input.categoryId);
  if (input.brandId) await assertBelongsToTenant(tx, "brand", input.brandId);

  const { barcode, ...rest } = input;

  const product = await tx.product.create({
    data: { ...rest, barcode, createdBy: userId, updatedBy: userId },
  });

  if (barcode) {
    await addBarcode(tx, product.id, { barcode, barcodeType: "EAN13", isPrimary: true });
  }

  return product;
}

export async function updateProduct(
  tx: TransactionClient,
  id: string,
  input: UpdateProductInput,
  userId: string,
) {
  if (input.unitId) await assertBelongsToTenant(tx, "unit", input.unitId);
  if (input.categoryId) await assertBelongsToTenant(tx, "productCategory", input.categoryId);
  if (input.brandId) await assertBelongsToTenant(tx, "brand", input.brandId);

  return tx.product.update({
    where: { id },
    data: { ...input, updatedBy: userId },
  });
}

export async function softDeleteProduct(tx: TransactionClient, id: string): Promise<void> {
  await tx.product.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function searchProducts(tx: TransactionClient, query: ProductSearchQuery) {
  const { q, categoryId, brandId, isActive, sort, order, page, pageSize } = query;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { barcode: q },
            { sku: q },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    tx.product.findMany({
      where,
      include: { category: true, brand: true, unit: true },
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.product.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function bulkProductAction(
  tx: TransactionClient,
  input: BulkProductActionInput,
): Promise<number> {
  const where = { id: { in: input.ids } };

  switch (input.action) {
    case "activate":
      return (await tx.product.updateMany({ where, data: { isActive: true } })).count;
    case "deactivate":
      return (await tx.product.updateMany({ where, data: { isActive: false } })).count;
    case "set_category":
      if (input.categoryId) {
        await assertBelongsToTenant(tx, "productCategory", input.categoryId);
      }
      return (
        await tx.product.updateMany({ where, data: { categoryId: input.categoryId ?? null } })
      ).count;
  }
}
