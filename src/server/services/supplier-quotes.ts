import type { Prisma } from "@prisma/client";
import type { CreateSupplierQuoteInput } from "@/lib/validators/purchasing";

type TransactionClient = Prisma.TransactionClient;

export async function createQuote(tx: TransactionClient, input: CreateSupplierQuoteInput) {
  return tx.supplierQuote.create({
    data: {
      supplierId: input.supplierId,
      status: "received",
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      notes: input.notes ?? null,
      items: { create: input.items },
    },
    include: { items: true, supplier: true },
  });
}

export async function listQuotes(tx: TransactionClient, supplierId?: string) {
  return tx.supplierQuote.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Supplier x product price matrix for the comparison view — one row per
 * quote that covers at least one of the requested products, with only the
 * matching line items included (not the quote's full item list, which may
 * cover unrelated products).
 */
export async function compareQuotes(
  tx: TransactionClient,
  productIds: string[],
  supplierIds?: string[],
) {
  return tx.supplierQuote.findMany({
    where: {
      items: { some: { productId: { in: productIds } } },
      ...(supplierIds && supplierIds.length > 0 ? { supplierId: { in: supplierIds } } : {}),
    },
    include: {
      supplier: true,
      items: { where: { productId: { in: productIds } }, include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
