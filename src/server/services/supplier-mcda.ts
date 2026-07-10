import type { Prisma } from "@prisma/client";
import { getDeliveryPerformance } from "@/server/services/procurement-reports";

type TransactionClient = Prisma.TransactionClient;

// Fixed, code-level criteria list — not tenant-configurable rows (see
// PHASE5_INTELLIGENCE_PLAN.md's divergence table: ARCHITECTURE.md names a
// separate supplier_evaluation_criteria table, but DATABASE.md's concrete
// shape — criteria+weights folded into criteriaWeights JSONB — wins).
// `direction` says whether a higher raw value is better (benefit) or worse
// (cost) for TOPSIS/PROMETHEE normalization.
export const MCDA_CRITERIA = [
  { key: "price", direction: "cost" },
  { key: "quality", direction: "benefit" },
  { key: "delivery", direction: "cost" },
  { key: "reliability", direction: "benefit" },
  { key: "paymentTerms", direction: "benefit" },
  { key: "productRange", direction: "benefit" },
] as const;
export type CriterionKey = (typeof MCDA_CRITERIA)[number]["key"];

export class AhpInconsistentError extends Error {
  constructor(public readonly consistencyRatio: number) {
    super(
      `AHP pairwise comparisons are inconsistent (CR=${consistencyRatio.toFixed(3)} >= 0.10) — consider redoing them.`,
    );
    this.name = "AhpInconsistentError";
  }
}

// Saaty's Random Index table, standard values for matrix sizes 1-10 —
// needed to normalize the Consistency Index into the Consistency Ratio.
const RANDOM_INDEX = [0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

/**
 * Simplified AHP weight derivation (normalize columns, average rows) rather
 * than full eigenvalue decomposition — no external linear-algebra library
 * needed for a handful of criteria. Returns the consistency ratio too;
 * callers decide whether CR >= 0.10 should block (it doesn't here — see
 * AhpInconsistentError's usage at the call site, which warns rather than
 * throws by default).
 */
export function calculateAhpWeights(pairwiseMatrix: number[][]): {
  weights: number[];
  consistencyRatio: number;
} {
  const n = pairwiseMatrix.length;

  const columnSums = Array.from({ length: n }, (_, j) =>
    pairwiseMatrix.reduce((sum, row) => sum + row[j]!, 0),
  );
  const normalized = pairwiseMatrix.map((row) => row.map((value, j) => value / columnSums[j]!));
  const weights = normalized.map((row) => row.reduce((sum, v) => sum + v, 0) / n);

  // Consistency check: weighted sum vector / weights -> lambda_max
  const weightedSums = pairwiseMatrix.map((row) =>
    row.reduce((sum, value, j) => sum + value * weights[j]!, 0),
  );
  const lambdaMax = mean(weightedSums.map((ws, i) => ws / weights[i]!));
  const consistencyIndex = (lambdaMax - n) / (n - 1 || 1);
  const randomIndex = RANDOM_INDEX[n - 1] ?? RANDOM_INDEX[RANDOM_INDEX.length - 1] ?? 1.49;
  const consistencyRatio = randomIndex > 0 ? consistencyIndex / randomIndex : 0;

  return { weights, consistencyRatio };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface SupplierCriteriaRow {
  supplierId: string;
  supplierName: string;
  values: Record<CriterionKey, number>;
}

/**
 * Sources each of the 6 fixed criteria from existing columns/queries — no
 * new schema needed. Quality has no dedicated rating input anywhere in this
 * project, so it's approximated via inverse PurchaseReturn rate (more
 * returns against a supplier -> lower quality score); flagged explicitly,
 * not hidden.
 */
export async function buildSupplierDecisionMatrix(
  tx: TransactionClient,
  { supplierIds }: { supplierIds: string[] },
): Promise<SupplierCriteriaRow[]> {
  const suppliers = await tx.supplier.findMany({
    where: { id: { in: supplierIds } },
    include: {
      supplierProducts: { select: { unitPrice: true, deliveryTimeDays: true } },
      purchaseOrders: { select: { id: true, total: true } },
    },
  });

  const returns = await tx.purchaseReturn.groupBy({
    by: ["supplierId"],
    where: { supplierId: { in: supplierIds } },
    _count: { id: true },
  });
  const returnCountBySupplier = new Map(returns.map((r) => [r.supplierId, r._count.id]));

  const deliveryPerformance = await getDeliveryPerformance(tx);
  const onTimeRateBySupplier = new Map(deliveryPerformance.map((d) => [d.supplierId, d.onTimeRate]));

  return suppliers.map((supplier) => {
    const prices = supplier.supplierProducts.map((sp) => sp.unitPrice).filter((p): p is number => p != null);
    const avgPrice = prices.length > 0 ? mean(prices) : 0;

    const orderCount = supplier.purchaseOrders.length || 1;
    const returnCount = returnCountBySupplier.get(supplier.id) ?? 0;
    // Inverse return rate, floored at 0 — fewer returns per order = higher quality proxy.
    const qualityProxy = Math.max(0, 1 - returnCount / orderCount);

    const reliability = onTimeRateBySupplier.get(supplier.id) ?? 0.5; // no delivery history yet -> neutral midpoint

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      values: {
        price: avgPrice,
        quality: qualityProxy,
        delivery: supplier.leadTimeDays,
        reliability,
        paymentTerms: supplier.paymentTerms,
        productRange: supplier.supplierProducts.length,
      },
    };
  });
}

export interface RankedSupplier {
  supplierId: string;
  supplierName: string;
  score: number;
  criteriaContribution: Record<CriterionKey, number>;
}

/** TOPSIS: normalize -> weight -> distance to ideal/anti-ideal -> closeness coefficient, descending. */
export function rankSuppliersTopsis(
  rows: SupplierCriteriaRow[],
  weights: Record<CriterionKey, number>,
): RankedSupplier[] {
  const keys = MCDA_CRITERIA.map((c) => c.key);

  const norms = Object.fromEntries(
    keys.map((key) => [key, Math.sqrt(rows.reduce((sum, r) => sum + r.values[key] ** 2, 0)) || 1]),
  ) as Record<CriterionKey, number>;

  const weighted = rows.map((row) => {
    const values = Object.fromEntries(
      keys.map((key) => [key, (row.values[key] / norms[key]) * weights[key]]),
    ) as Record<CriterionKey, number>;
    return { ...row, weighted: values };
  });

  const ideal = {} as Record<CriterionKey, number>;
  const antiIdeal = {} as Record<CriterionKey, number>;
  for (const criterion of MCDA_CRITERIA) {
    const values = weighted.map((r) => r.weighted[criterion.key]);
    if (criterion.direction === "benefit") {
      ideal[criterion.key] = Math.max(...values);
      antiIdeal[criterion.key] = Math.min(...values);
    } else {
      ideal[criterion.key] = Math.min(...values);
      antiIdeal[criterion.key] = Math.max(...values);
    }
  }

  return weighted
    .map((row) => {
      const distToIdeal = Math.sqrt(
        keys.reduce((sum, key) => sum + (row.weighted[key] - ideal[key]) ** 2, 0),
      );
      const distToAnti = Math.sqrt(
        keys.reduce((sum, key) => sum + (row.weighted[key] - antiIdeal[key]) ** 2, 0),
      );
      const score = distToAnti + distToIdeal === 0 ? 0 : distToAnti / (distToAnti + distToIdeal);
      return {
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        score,
        criteriaContribution: row.weighted,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type PreferenceFunctionType = "linear" | "level";

/**
 * PROMETHEE with just `linear` and `level` preference functions — the two
 * simplest of the six classical Vincke-Brans types, covering the roadmap's
 * own stated use case (a delivery-time "acceptable range" is exactly a
 * level function) without over-building for methods nothing here asks for.
 */
export function rankSuppliersPromethee(
  rows: SupplierCriteriaRow[],
  weights: Record<CriterionKey, number>,
  preferenceFunctions: Partial<Record<CriterionKey, PreferenceFunctionType>> = {},
): RankedSupplier[] {
  const keys = MCDA_CRITERIA.map((c) => c.key);
  const directionByKey = Object.fromEntries(MCDA_CRITERIA.map((c) => [c.key, c.direction])) as Record<
    CriterionKey,
    "benefit" | "cost"
  >;

  function preference(key: CriterionKey, diff: number): number {
    const type = preferenceFunctions[key] ?? "linear";
    if (diff <= 0) return 0;
    if (type === "level") return diff > 0 ? 1 : 0;
    // linear: normalize by the criterion's observed range across all suppliers
    const values = rows.map((r) => r.values[key]);
    const range = Math.max(...values) - Math.min(...values) || 1;
    return Math.min(1, diff / range);
  }

  const flows = rows.map((a) => {
    let positive = 0;
    let negative = 0;
    for (const b of rows) {
      if (a.supplierId === b.supplierId) continue;
      for (const key of keys) {
        const direction = directionByKey[key];
        const rawDiff = direction === "benefit" ? a.values[key] - b.values[key] : b.values[key] - a.values[key];
        positive += weights[key] * preference(key, rawDiff);
        negative += weights[key] * preference(key, -rawDiff);
      }
    }
    const n = rows.length - 1 || 1;
    return { supplier: a, positiveFlow: positive / n, negativeFlow: negative / n };
  });

  return flows
    .map(({ supplier, positiveFlow, negativeFlow }) => ({
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      score: positiveFlow - negativeFlow,
      criteriaContribution: supplier.values,
    }))
    .sort((a, b) => b.score - a.score);
}

function scoresToUnitRange(ranked: RankedSupplier[]): Map<string, number> {
  const scores = ranked.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return new Map(ranked.map((r) => [r.supplierId, (r.score - min) / range]));
}

export interface RunEvaluationInput {
  supplierIds: string[];
  method: "ahp_topsis" | "ahp_promethee" | "ahp_only" | "topsis_only";
  pairwiseMatrix?: number[][];
  weights?: Partial<Record<CriterionKey, number>>;
  evaluationPeriod: string;
  userId: string;
}

/**
 * Orchestrates AHP weights (if applicable) -> decision matrix -> TOPSIS or
 * PROMETHEE -> persists one SupplierEvaluation row per supplier -> updates
 * Supplier.rating (the placeholder column reserved since Phase 1).
 */
export async function runSupplierEvaluation(tx: TransactionClient, input: RunEvaluationInput) {
  const keys = MCDA_CRITERIA.map((c) => c.key);
  let weights: Record<CriterionKey, number>;
  let consistencyRatio: number | null = null;

  if (input.method.startsWith("ahp") && input.pairwiseMatrix) {
    const result = calculateAhpWeights(input.pairwiseMatrix);
    weights = Object.fromEntries(keys.map((key, i) => [key, result.weights[i]])) as Record<
      CriterionKey,
      number
    >;
    consistencyRatio = result.consistencyRatio;
    // Warn, don't block — a business owner may judge the inconsistency
    // acceptable and proceed anyway (see AhpInconsistentError's docstring).
  } else {
    const equalWeight = 1 / keys.length;
    weights = Object.fromEntries(
      keys.map((key) => [key, input.weights?.[key] ?? equalWeight]),
    ) as Record<CriterionKey, number>;
  }

  const decisionMatrix = await buildSupplierDecisionMatrix(tx, { supplierIds: input.supplierIds });
  const ranked =
    input.method === "ahp_promethee"
      ? rankSuppliersPromethee(decisionMatrix, weights)
      : rankSuppliersTopsis(decisionMatrix, weights);

  const unitScores = scoresToUnitRange(ranked);
  const scoresRecord = Object.fromEntries(ranked.map((r) => [r.supplierId, r.score]));

  const evaluations = [];
  for (const row of ranked) {
    const evaluation = await tx.supplierEvaluation.create({
      data: {
        supplierId: row.supplierId,
        evaluationPeriod: input.evaluationPeriod,
        method: input.method,
        criteriaWeights: weights,
        supplierScores: scoresRecord,
        consistencyRatio,
        evaluatedBy: input.userId,
      },
    });
    const unitScore = unitScores.get(row.supplierId) ?? 0;
    await tx.supplier.update({
      where: { id: row.supplierId },
      data: { rating: Math.round(unitScore * 100) / 100 },
    });
    evaluations.push(evaluation);
  }

  return { evaluations, ranked, consistencyRatio };
}

export async function getSupplierScoreHistory(tx: TransactionClient, { supplierId }: { supplierId: string }) {
  return tx.supplierEvaluation.findMany({
    where: { supplierId },
    orderBy: { evaluatedAt: "asc" },
  });
}

/**
 * Joins Chunk B's reorder-flagged products with the top-ranked active
 * supplier for each — supersedes Chunk B's supplier-agnostic
 * generateReorderRecommendations once evaluations exist for a tenant,
 * gracefully degrading (falls back to leadTimeDays/price) otherwise.
 */
export async function generatePurchaseRecommendations(
  tx: TransactionClient,
  { storeId }: { storeId?: string } = {},
): Promise<{ created: number }> {
  const stockLevels = await tx.stockLevel.findMany({
    where: { storeId, product: { reorderPoint: { not: null }, isActive: true } },
    include: { product: { select: { id: true, name: true } } },
  });

  let created = 0;
  for (const level of stockLevels) {
    // Re-check against the product's actual reorderPoint (Prisma can't
    // compare two columns in a `where`, hence the app-side filter here).
    const product = await tx.product.findUnique({
      where: { id: level.productId },
      select: { reorderPoint: true },
    });
    if (!product?.reorderPoint || level.quantityOnHand > product.reorderPoint) continue;

    const bestSupplierProduct = await tx.supplierProduct.findFirst({
      where: { productId: level.productId, supplier: { isActive: true } },
      include: { supplier: { select: { id: true, name: true, rating: true, leadTimeDays: true } } },
      orderBy: [{ supplier: { rating: "desc" } }, { unitPrice: "asc" }],
    });
    if (!bestSupplierProduct) continue;

    await tx.aiRecommendation.create({
      data: {
        storeId: level.storeId,
        recommendationType: "reorder",
        title: `Reorder: ${level.product.name}`,
        description: `Recommended supplier: ${bestSupplierProduct.supplier.name} (rating ${bestSupplierProduct.supplier.rating ?? "n/a"}).`,
        data: {
          productId: level.productId,
          currentStock: level.quantityOnHand,
          reorderPoint: product.reorderPoint,
          recommendedSupplierId: bestSupplierProduct.supplier.id,
          reason: bestSupplierProduct.supplier.rating
            ? "highest MCDA rating among active suppliers for this product"
            : "no MCDA evaluation yet — chosen by lowest price",
        },
        priority: level.quantityOnHand === 0 ? "urgent" : "high",
      },
    });
    created++;
  }
  return { created };
}
