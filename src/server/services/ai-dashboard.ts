import type { Prisma } from "@prisma/client";
import { predictExpirationRisk } from "@/server/services/waste-prediction";

type TransactionClient = Prisma.TransactionClient;

/**
 * One aggregating route/function for the Phase 5 dashboard's top-level
 * tiles, rather than the frontend making four separate calls to four
 * different chunks' routes on every load.
 */
export async function getDashboardSummary(tx: TransactionClient) {
  const [pendingRecommendations, accuracyAgg, topSuppliers, expiringBatches] = await Promise.all([
    tx.aiRecommendation.count({ where: { isActioned: false } }),
    tx.demandForecast.aggregate({ _avg: { accuracyMape: true }, where: { accuracyMape: { not: null } } }),
    tx.supplier.findMany({
      where: { rating: { not: null }, isActive: true },
      orderBy: { rating: "desc" },
      take: 5,
      select: { id: true, name: true, rating: true },
    }),
    predictExpirationRisk(tx),
  ]);

  return {
    pendingRecommendations,
    forecastAccuracyAvg: accuracyAgg._avg.accuracyMape,
    topSuppliers,
    expiringBatchCount: expiringBatches.length,
  };
}
