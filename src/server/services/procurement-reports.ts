import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { withTenant } from "@/lib/prisma";

type TransactionClient = Prisma.TransactionClient;

// PO statuses that represent real committed spend — drafts/pending/cancelled
// POs aren't money actually spent yet.
const COMMITTED_PO_STATUSES = ["ordered", "partially_received", "received"] as const;

interface ReorderSuggestionRow {
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  quantityOnHand: number;
  minStockLevel: number;
  supplierId: string | null;
  supplierName: string | null;
  suggestedQuantity: number | null;
}

/**
 * Threshold on Product.minStockLevel, not reorderPoint/safetyStock — both
 * stay null until Phase 5's optimization engine exists (see the schema
 * comment on Product). Suggested quantity defaults to the preferred
 * supplier's minOrderQuantity; falls back to any linked supplier if none is
 * marked preferred, and is omitted entirely if the product has no supplier
 * link at all (nothing to suggest ordering from).
 *
 * Comparing StockLevel.quantityOnHand against Product.minStockLevel is a
 * cross-column comparison Prisma can't express in a typed `where` — done in
 * raw SQL instead (was previously: load every StockLevel for the tenant with
 * a 4-level include, then `.filter()` in JS). RLS still applies: this runs
 * on the same tenant-scoped connection/transaction as every other query in
 * `tx`, so `SET LOCAL app.current_tenant_id` already constrains every table
 * touched here — no manual tenant_id filter needed.
 */
export async function getReorderSuggestions(tx: TransactionClient) {
  return tx.$queryRaw<ReorderSuggestionRow[]>`
    SELECT DISTINCT ON (sl.id)
      sl.product_id       AS "productId",
      p.name               AS "productName",
      sl.store_id          AS "storeId",
      st.name              AS "storeName",
      sl.quantity_on_hand  AS "quantityOnHand",
      p.min_stock_level    AS "minStockLevel",
      sup.id               AS "supplierId",
      sup.name             AS "supplierName",
      spd.min_order_quantity AS "suggestedQuantity"
    FROM stock_levels sl
    JOIN products p ON p.id = sl.product_id AND p.deleted_at IS NULL
    JOIN stores st ON st.id = sl.store_id
    LEFT JOIN supplier_products spd ON spd.product_id = p.id
    LEFT JOIN suppliers sup ON sup.id = spd.supplier_id
    WHERE sl.quantity_on_hand <= p.min_stock_level
    ORDER BY sl.id, spd.is_preferred DESC NULLS LAST, spd.updated_at DESC NULLS LAST
  `.then((rows) =>
    rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      storeId: row.storeId,
      storeName: row.storeName,
      quantityOnHand: row.quantityOnHand,
      minStockLevel: row.minStockLevel,
      supplier: row.supplierId ? { id: row.supplierId, name: row.supplierName! } : null,
      suggestedQuantity: row.suggestedQuantity,
    })),
  );
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
