import type { Prisma } from "@prisma/client";
import type {
  BulkProductActionInput,
  CreateProductInput,
  ProductCatalogSyncQuery,
  ProductSearchQuery,
  UpdateProductInput,
} from "@/lib/validators/products";
import { addBarcode } from "./barcodes";

type TransactionClient = Prisma.TransactionClient;

// Safety cap — a runaway catalog can't force an unbounded response even
// on the very first (no updatedSince) sync.
const CATALOG_SYNC_MAX_ROWS = 10_000;

export interface ProductCatalogSyncRow {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  tvaRate: number;
  isActive: boolean;
  deleted: boolean;
}

/**
 * Feeds the POS's offline Dexie cache (use-product-catalog-sync.ts /
 * product-cache-sync.ts). Previously that hook paginated the full,
 * `include`-heavy `searchProducts` 20 times (2000 products, 100/page) on
 * every POS mount and every 5 minutes, clearing and rebuilding the whole
 * local table regardless of what actually changed. This is a single lean
 * flat `select` (no joins) and, once `updatedSince` is provided, only rows
 * that changed since — including ones that became inactive or were soft-
 * deleted, so the client can evict them instead of just never refreshing.
 * The caller captures its own "now" *before* calling this (see the route)
 * and uses that as next sync's watermark, so nothing committed mid-query
 * is missed.
 */
export async function getProductCatalogSync(
  tx: TransactionClient,
  query: ProductCatalogSyncQuery,
): Promise<ProductCatalogSyncRow[]> {
  const { updatedSince } = query;

  const where: Prisma.ProductWhereInput = updatedSince
    ? { updatedAt: { gt: updatedSince } }
    : { deletedAt: null, isActive: true };

  const rows = await tx.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      barcode: true,
      sellingPrice: true,
      tvaRate: true,
      isActive: true,
      deletedAt: true,
    },
    take: CATALOG_SYNC_MAX_ROWS,
  });

  return rows.map(({ deletedAt, ...row }) => ({ ...row, deleted: deletedAt !== null }));
}

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
