import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export interface StoreSummary {
  storeId: string;
  storeName: string;
  isMain: boolean;
  todaySales: number;
  todaySaleCount: number;
  lowStockCount: number;
}

/**
 * Store-by-store breakdown for the multi-store dashboard (Phase 6 Chunk C).
 * Reuses the same today's-sales/low-stock queries the KPI widget catalog
 * uses, just parameterized per store instead of tenant-wide.
 */
export async function getMultiStoreSummary(tx: TransactionClient): Promise<StoreSummary[]> {
  const stores = await tx.store.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return Promise.all(
    stores.map(async (store) => {
      const [salesAgg, levels] = await Promise.all([
        tx.sale.aggregate({
          where: { storeId: store.id, status: "completed", createdAt: { gte: startOfToday } },
          _sum: { total: true },
          _count: true,
        }),
        tx.stockLevel.findMany({
          where: { storeId: store.id },
          select: { quantityOnHand: true, product: { select: { minStockLevel: true } } },
        }),
      ]);

      // quantityOnHand <= minStockLevel is a cross-column comparison Prisma
      // can't express in `where` — filtered in JS, same pattern
      // getReorderSuggestions uses tenant-wide.
      const lowStockCount = levels.filter((l) => l.quantityOnHand <= l.product.minStockLevel).length;

      return {
        storeId: store.id,
        storeName: store.name,
        isMain: store.isMain,
        todaySales: salesAgg._sum.total ?? 0,
        todaySaleCount: salesAgg._count,
        lowStockCount,
      };
    }),
  );
}
