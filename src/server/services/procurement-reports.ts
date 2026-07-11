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

interface BySupplierRow {
  supplierId: string;
  supplierName: string;
  total: bigint;
}
interface ByCategoryRow {
  categoryId: string | null;
  categoryName: string;
  total: bigint;
}

/**
 * Spend by supplier and by category, aggregated from committed POs only.
 * Previously: load every committed PO with a 2-level include (items ->
 * product -> category), then `.reduce()` into two maps in JS. Two GROUP BYs
 * instead — bySupplier sums PurchaseOrder.total directly, byCategory joins
 * down to PurchaseOrderItem.total since category lives on Product, not PO.
 */
export async function getPurchaseAnalytics(tx: TransactionClient) {
  const [bySupplier, byCategory] = await Promise.all([
    tx.$queryRaw<BySupplierRow[]>`
      SELECT po.supplier_id AS "supplierId", s.name AS "supplierName", SUM(po.total) AS total
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.status IN ('ordered', 'partially_received', 'received') AND po.deleted_at IS NULL
      GROUP BY po.supplier_id, s.name
      ORDER BY total DESC
    `,
    tx.$queryRaw<ByCategoryRow[]>`
      SELECT p.category_id AS "categoryId", COALESCE(c.name, 'Sans catégorie') AS "categoryName", SUM(poi.total) AS total
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      JOIN products p ON p.id = poi.product_id
      LEFT JOIN product_categories c ON c.id = p.category_id
      WHERE po.status IN ('ordered', 'partially_received', 'received') AND po.deleted_at IS NULL
      GROUP BY p.category_id, c.name
      ORDER BY total DESC
    `,
  ]);

  return {
    bySupplier: bySupplier.map((row) => ({ ...row, total: Number(row.total) })),
    byCategory: byCategory.map((row) => ({ ...row, total: Number(row.total) })),
  };
}

interface DeliveryPerformanceRow {
  supplierId: string;
  supplierName: string;
  onTimeCount: bigint;
  totalCount: bigint;
}

/**
 * On-time rate per supplier: PurchaseDelivery.deliveredAt vs. the parent
 * PO's expectedDeliveryDate. Previously: load every delivered-with-an-
 * expected-date delivery (2-level include: po -> supplier), tally two
 * counters per supplier in JS. One GROUP BY with a FILTER clause instead.
 */
export async function getDeliveryPerformance(tx: TransactionClient) {
  const rows = await tx.$queryRaw<DeliveryPerformanceRow[]>`
    SELECT
      po.supplier_id AS "supplierId",
      s.name AS "supplierName",
      COUNT(*) FILTER (WHERE pd.delivered_at <= po.expected_delivery_date) AS "onTimeCount",
      COUNT(*) AS "totalCount"
    FROM purchase_deliveries pd
    JOIN purchase_orders po ON po.id = pd.po_id
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE pd.delivered_at IS NOT NULL AND po.expected_delivery_date IS NOT NULL
    GROUP BY po.supplier_id, s.name
    ORDER BY "totalCount" DESC
  `;

  return rows.map((row) => {
    const onTimeCount = Number(row.onTimeCount);
    const totalCount = Number(row.totalCount);
    return {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      onTimeCount,
      totalCount,
      onTimeRate: onTimeCount / totalCount,
    };
  });
}
