import type { Prisma } from "@prisma/client";
import type { SalesReportQuery } from "@/lib/validators/reports";

type TransactionClient = Prisma.TransactionClient;

function bucketKey(date: Date, granularity: "daily" | "weekly" | "monthly"): string {
  if (granularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") {
    const weekStart = new Date(date);
    const day = (weekStart.getDay() + 6) % 7; // 0 = Monday
    weekStart.setDate(weekStart.getDate() - day);
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Sales summary report: revenue/basket buckets (same JS-aggregation style as
 * financial-reports.ts's getRevenueDashboard) plus top products by quantity
 * sold, over the given date range.
 */
export async function getSalesSummaryReport(tx: TransactionClient, query: SalesReportQuery) {
  const { storeId, from, to, granularity } = query;

  const sales = await tx.sale.findMany({
    where: {
      status: "completed",
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
    },
    select: { id: true, createdAt: true, total: true },
  });

  const buckets = new Map<string, { period: string; revenue: number; saleCount: number }>();
  for (const sale of sales) {
    const key = bucketKey(sale.createdAt, granularity);
    const entry = buckets.get(key) ?? { period: key, revenue: 0, saleCount: 0 };
    entry.revenue += sale.total;
    entry.saleCount += 1;
    buckets.set(key, entry);
  }

  const saleIds = sales.map((s) => s.id);
  const items = saleIds.length
    ? await tx.saleItem.findMany({
        where: { saleId: { in: saleIds } },
        select: { productId: true, productName: true, quantity: true, total: true },
      })
    : [];

  const byProduct = new Map<string, { productId: string; productName: string; quantitySold: number; revenue: number }>();
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? {
      productId: item.productId,
      productName: item.productName,
      quantitySold: 0,
      revenue: 0,
    };
    entry.quantitySold += item.quantity;
    entry.revenue += item.total;
    byProduct.set(item.productId, entry);
  }

  const topProducts = [...byProduct.values()].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 20);
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const saleCount = sales.length;

  return {
    buckets: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)),
    topProducts,
    summary: {
      totalRevenue,
      saleCount,
      averageBasket: saleCount > 0 ? Math.round(totalRevenue / saleCount) : 0,
    },
  };
}
