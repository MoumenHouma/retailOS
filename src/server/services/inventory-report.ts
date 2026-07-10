import type { Prisma } from "@prisma/client";
import type { InventoryReportQuery } from "@/lib/validators/reports";
import { predictExpirationRisk } from "@/server/services/waste-prediction";

type TransactionClient = Prisma.TransactionClient;

/**
 * Inventory status report: stock value at cost, low/overstock flags (same
 * Product.minStockLevel/maxStockLevel threshold procurement-reports.ts uses
 * for reorder suggestions), and expiring-batch risk (reused from Phase 5
 * Chunk B's predictExpirationRisk, not reimplemented).
 */
export async function getInventoryStatusReport(tx: TransactionClient, query: InventoryReportQuery) {
  const { storeId } = query;

  const levels = await tx.stockLevel.findMany({
    where: storeId ? { storeId } : {},
    include: {
      product: { select: { name: true, costPrice: true, minStockLevel: true, maxStockLevel: true } },
      store: { select: { name: true } },
    },
  });

  const rows = levels.map((level) => {
    const costPrice = level.product.costPrice ?? 0;
    const stockValue = costPrice * level.quantityOnHand;
    const isLowStock = level.quantityOnHand <= level.product.minStockLevel;
    const isOverstock =
      level.product.maxStockLevel != null && level.quantityOnHand > level.product.maxStockLevel;
    return {
      productId: level.productId,
      productName: level.product.name,
      storeId: level.storeId,
      storeName: level.store.name,
      quantityOnHand: level.quantityOnHand,
      stockValue,
      isLowStock,
      isOverstock,
    };
  });

  const totalStockValue = rows.reduce((sum, r) => sum + r.stockValue, 0);
  const lowStockCount = rows.filter((r) => r.isLowStock).length;
  const overstockCount = rows.filter((r) => r.isOverstock).length;

  const expiringBatches = await predictExpirationRisk(tx, { storeId });

  return {
    rows,
    summary: { totalStockValue, lowStockCount, overstockCount, skuCount: rows.length },
    expiringBatches,
  };
}
