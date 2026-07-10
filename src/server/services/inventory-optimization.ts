import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

// Tenant-level constants for this phase, per PHASE5_INTELLIGENCE_PLAN.md's
// "hardcode first, Tenant.settings JSON later if needed" decision — same
// precedent Phase 4 Chunk B used for loyalty ratios. No schema exists for
// per-product tuning and the roadmap doesn't ask for it.
const DEFAULT_ORDERING_COST = 500; // DA per purchase order placed
const DEFAULT_HOLDING_COST_RATE = 0.2; // 20% of unit cost per year, standard retail default
const DEFAULT_LEAD_TIME_DAYS = 7;
const HISTORY_LOOKBACK_DAYS = 90;

/** Standard service-level -> z-score lookup, no external stats library needed. */
const SERVICE_LEVEL_Z_SCORES: Record<number, number> = {
  90: 1.28,
  95: 1.65,
  99: 2.33,
};
const DEFAULT_SERVICE_LEVEL = 95;

export function calculateEOQ({
  annualDemand,
  orderingCost = DEFAULT_ORDERING_COST,
  holdingCost,
}: {
  annualDemand: number;
  orderingCost?: number;
  holdingCost: number;
}): number {
  if (annualDemand <= 0 || holdingCost <= 0) return 0;
  return Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost));
}

export function calculateSafetyStock({
  demandStdDev,
  leadTimeDays,
  serviceLevel = DEFAULT_SERVICE_LEVEL,
}: {
  demandStdDev: number;
  leadTimeDays: number;
  serviceLevel?: number;
}): number {
  const z = SERVICE_LEVEL_Z_SCORES[serviceLevel] ?? SERVICE_LEVEL_Z_SCORES[DEFAULT_SERVICE_LEVEL] ?? 1.65;
  return Math.max(0, Math.round(z * demandStdDev * Math.sqrt(Math.max(leadTimeDays, 0))));
}

export function calculateReorderPoint({
  avgDailyDemand,
  leadTimeDays,
  safetyStock,
}: {
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
}): number {
  return Math.max(0, Math.round(avgDailyDemand * leadTimeDays + safetyStock));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Pulls Chunk A's forecast rows (avg + stddev of predictedQuantity) and the
 * preferred/cheapest supplier's lead time, then writes Product.reorderPoint/
 * safetyStock — the two placeholder columns reserved since Phase 1.
 * Batch/on-demand, same precedent as Phase 4 Chunk D's commission
 * calculation — not hooked into the hot POS path. Typically chained
 * automatically at the end of a successful forecast job (see worker.ts),
 * since a forecast completing is exactly the right moment to recompute this.
 */
export async function recomputeProductOptimization(
  tx: TransactionClient,
  { productId, storeId }: { productId: string; storeId: string },
): Promise<{ reorderPoint: number; safetyStock: number; eoq: number } | null> {
  const forecasts = await tx.demandForecast.findMany({
    where: { productId, storeId },
    orderBy: { forecastDate: "desc" },
    take: HISTORY_LOOKBACK_DAYS,
    select: { predictedQuantity: true },
  });
  if (forecasts.length === 0) return null;

  const quantities = forecasts.map((f) => f.predictedQuantity);
  const avgDailyDemand = mean(quantities);
  const demandStdDev = stdDev(quantities);

  const preferredSupplierProduct = await tx.supplierProduct.findFirst({
    where: { productId },
    orderBy: [{ isPreferred: "desc" }, { updatedAt: "desc" }],
    include: { supplier: { select: { leadTimeDays: true } } },
  });
  const leadTimeDays =
    preferredSupplierProduct?.deliveryTimeDays ??
    preferredSupplierProduct?.supplier.leadTimeDays ??
    DEFAULT_LEAD_TIME_DAYS;

  const product = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { costPrice: true, sellingPrice: true },
  });
  const unitCost = product.costPrice ?? product.sellingPrice;
  const holdingCost = unitCost * DEFAULT_HOLDING_COST_RATE;

  const safetyStock = calculateSafetyStock({ demandStdDev, leadTimeDays });
  const reorderPoint = calculateReorderPoint({ avgDailyDemand, leadTimeDays, safetyStock });
  const eoq = calculateEOQ({ annualDemand: avgDailyDemand * 365, holdingCost });

  await tx.product.update({
    where: { id: productId },
    data: { reorderPoint, safetyStock },
  });

  return { reorderPoint, safetyStock, eoq };
}

/** Batch variant: recomputes every product that already has a forecast for this store. */
export async function recomputeStoreOptimization(
  tx: TransactionClient,
  { storeId }: { storeId: string },
): Promise<{ recomputed: number }> {
  const productIds = await tx.demandForecast.findMany({
    where: { storeId },
    distinct: ["productId"],
    select: { productId: true },
  });

  let recomputed = 0;
  for (const { productId } of productIds) {
    const result = await recomputeProductOptimization(tx, { productId, storeId });
    if (result) recomputed++;
  }
  return { recomputed };
}

/**
 * Creates a "reorder" AiRecommendation for every product whose on-hand
 * stock has dropped to or below its computed reorderPoint. Supplier-agnostic
 * — Chunk C's generatePurchaseRecommendations supersedes this once supplier
 * evaluations exist for the tenant, gracefully degrading to this otherwise.
 */
export async function generateReorderRecommendations(
  tx: TransactionClient,
  { storeId }: { storeId?: string } = {},
): Promise<{ created: number }> {
  const stockLevels = await tx.stockLevel.findMany({
    where: {
      storeId,
      product: { reorderPoint: { not: null }, isActive: true },
    },
    include: { product: { select: { id: true, name: true, reorderPoint: true, costPrice: true, sellingPrice: true } } },
  });

  let created = 0;
  for (const level of stockLevels) {
    const reorderPoint = level.product.reorderPoint ?? 0;
    if (level.quantityOnHand > reorderPoint) continue;

    const unitCost = level.product.costPrice ?? level.product.sellingPrice;
    const eoq = calculateEOQ({
      annualDemand: Math.max(reorderPoint * 12, 1),
      holdingCost: unitCost * DEFAULT_HOLDING_COST_RATE,
    });

    await tx.aiRecommendation.create({
      data: {
        storeId: level.storeId,
        recommendationType: "reorder",
        title: `Reorder: ${level.product.name}`,
        description: `On-hand stock (${level.quantityOnHand}) has reached the reorder point (${reorderPoint}).`,
        data: {
          productId: level.product.id,
          currentStock: level.quantityOnHand,
          reorderPoint,
          suggestedQuantity: eoq || reorderPoint,
        },
        priority: level.quantityOnHand === 0 ? "urgent" : "high",
      },
    });
    created++;
  }
  return { created };
}
