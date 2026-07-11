import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { withTenant } from "@/lib/prisma";

type TransactionClient = Prisma.TransactionClient;

// PO statuses that represent real committed spend — drafts/pending/cancelled
// POs aren't money actually spent yet.
const COMMITTED_PO_STATUSES = ["ordered", "partially_received", "received"] as const;

/**
 * Threshold on Product.minStockLevel, not reorderPoint/safetyStock — both
 * stay null until Phase 5's optimization engine exists (see the schema
 * comment on Product). Suggested quantity defaults to the preferred
 * supplier's minOrderQuantity; falls back to any linked supplier if none is
 * marked preferred, and is omitted entirely if the product has no supplier
 * link at all (nothing to suggest ordering from).
 *
 * Comparing StockLevel.quantityOnHand against Product.minStockLevel is a
 * cross-column comparison Prisma can't express in `where` — filtered in JS,
 * same pattern getStockLevels already uses for isLowStock.
 */
export async function getReorderSuggestions(tx: TransactionClient) {
  const levels = await tx.stockLevel.findMany({
    include: {
      product: {
        include: {
          supplierProducts: { include: { supplier: true } },
        },
      },
      store: { select: { name: true } },
    },
  });

  return levels
    .filter((level) => level.quantityOnHand <= level.product.minStockLevel)
    .map((level) => {
      const preferred =
        level.product.supplierProducts.find((sp) => sp.isPreferred) ?? level.product.supplierProducts[0];
      return {
        productId: level.productId,
        productName: level.product.name,
        storeId: level.storeId,
        storeName: level.store.name,
        quantityOnHand: level.quantityOnHand,
        minStockLevel: level.product.minStockLevel,
        supplier: preferred ? { id: preferred.supplier.id, name: preferred.supplier.name } : null,
        suggestedQuantity: preferred?.minOrderQuantity ?? null,
      };
    });
}

/**
 * Cached wrapper — getReorderSuggestions runs on every dashboard page load
 * with a full-table StockLevel scan (see the comment above). Opens its own
 * withTenant instead of taking the caller's `tx`: unstable_cache's cached
 * function body runs outside the request's transaction, so it can't reuse
 * an already-open tx. Invalidated by revalidateTag(`stock:${tenantId}`),
 * called by every route that mutates stock (sales, adjustments, transfers,
 * stock counts, purchase deliveries, returns) after their withTenant
 * transaction commits.
 */
export function getReorderSuggestionsCached(tenantId: string) {
  return unstable_cache(
    () => withTenant(tenantId, (tx) => getReorderSuggestions(tx)),
    ["reorder-suggestions", tenantId],
    { revalidate: 60, tags: [`stock:${tenantId}`] },
  )();
}

interface SupplierCatalogQuery {
  supplierId?: string;
  productId?: string;
  page: number;
  pageSize: number;
}

/**
 * Distinct from suppliers/[id]'s LinkedProductsDialog, which only ever
 * shows one supplier's products at a time — this is the reverse/global
 * browser across every SupplierProduct row.
 */
export async function getSupplierCatalog(tx: TransactionClient, query: SupplierCatalogQuery) {
  const { supplierId, productId, page, pageSize } = query;
  const where: Prisma.SupplierProductWhereInput = {
    ...(supplierId ? { supplierId } : {}),
    ...(productId ? { productId } : {}),
  };

  const [items, total] = await Promise.all([
    tx.supplierProduct.findMany({
      where,
      include: { supplier: { select: { name: true } }, product: { select: { name: true, sku: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.supplierProduct.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/** Spend by supplier and by category, aggregated from committed POs only. */
export async function getPurchaseAnalytics(tx: TransactionClient) {
  const orders = await tx.purchaseOrder.findMany({
    where: { status: { in: [...COMMITTED_PO_STATUSES] }, deletedAt: null },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { include: { product: { select: { categoryId: true, category: { select: { name: true } } } } } },
    },
  });

  const bySupplier = new Map<string, { supplierId: string; supplierName: string; total: number }>();
  const byCategory = new Map<string, { categoryId: string | null; categoryName: string; total: number }>();

  for (const order of orders) {
    const supplierEntry = bySupplier.get(order.supplierId) ?? {
      supplierId: order.supplierId,
      supplierName: order.supplier.name,
      total: 0,
    };
    supplierEntry.total += order.total;
    bySupplier.set(order.supplierId, supplierEntry);

    for (const item of order.items) {
      const categoryId = item.product.categoryId;
      const key = categoryId ?? "__uncategorized__";
      const categoryEntry = byCategory.get(key) ?? {
        categoryId,
        categoryName: item.product.category?.name ?? "Sans catégorie",
        total: 0,
      };
      categoryEntry.total += item.total;
      byCategory.set(key, categoryEntry);
    }
  }

  return {
    bySupplier: [...bySupplier.values()].sort((a, b) => b.total - a.total),
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
  };
}

/** On-time rate per supplier: PurchaseDelivery.deliveredAt vs. the parent PO's expectedDeliveryDate. */
export async function getDeliveryPerformance(tx: TransactionClient) {
  const deliveries = await tx.purchaseDelivery.findMany({
    where: { deliveredAt: { not: null }, po: { expectedDeliveryDate: { not: null } } },
    include: { po: { include: { supplier: { select: { id: true, name: true } } } } },
  });

  const bySupplier = new Map<
    string,
    { supplierId: string; supplierName: string; onTimeCount: number; totalCount: number }
  >();

  for (const delivery of deliveries) {
    const entry = bySupplier.get(delivery.po.supplierId) ?? {
      supplierId: delivery.po.supplierId,
      supplierName: delivery.po.supplier.name,
      onTimeCount: 0,
      totalCount: 0,
    };
    entry.totalCount += 1;
    if (delivery.deliveredAt! <= delivery.po.expectedDeliveryDate!) {
      entry.onTimeCount += 1;
    }
    bySupplier.set(delivery.po.supplierId, entry);
  }

  return [...bySupplier.values()]
    .map((entry) => ({ ...entry, onTimeRate: entry.onTimeCount / entry.totalCount }))
    .sort((a, b) => b.totalCount - a.totalCount);
}
