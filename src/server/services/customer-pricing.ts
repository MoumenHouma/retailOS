import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function setCustomerPrice(
  tx: TransactionClient,
  input: { customerId: string; productId: string; price: number },
) {
  const existing = await tx.customerPrice.findFirst({
    where: { customerId: input.customerId, productId: input.productId },
  });
  if (existing) {
    return tx.customerPrice.update({
      where: { id: existing.id },
      data: { price: input.price, isActive: true },
    });
  }
  return tx.customerPrice.create({ data: input });
}

export async function removeCustomerPrice(tx: TransactionClient, id: string): Promise<void> {
  await tx.customerPrice.delete({ where: { id } });
}

export async function listCustomerPrices(tx: TransactionClient, customerId: string) {
  return tx.customerPrice.findMany({
    where: { customerId, isActive: true },
    include: { product: { select: { id: true, name: true, sellingPrice: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Bulk lookup for sales.ts's priceItems() — one query for every line in the
 * cart rather than N. Returns a Map keyed by productId; a product with no
 * override simply isn't in the map, so callers fall back to
 * Product.sellingPrice.
 */
export async function getEffectivePrices(
  tx: TransactionClient,
  customerId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  const overrides = await tx.customerPrice.findMany({
    where: { customerId, productId: { in: productIds }, isActive: true },
    select: { productId: true, price: true },
  });
  return new Map(overrides.map((row) => [row.productId, row.price]));
}
