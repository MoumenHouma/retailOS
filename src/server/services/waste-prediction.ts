import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

const EXPIRY_HORIZON_DAYS = 30;
const VELOCITY_LOOKBACK_DAYS = 14;

export interface ExpirationRisk {
  batchId: string;
  productId: string;
  productName: string;
  storeId: string;
  quantityRemaining: number;
  expirationDate: Date;
  daysUntilExpiry: number;
  avgDailyVelocity: number;
  daysToSellOut: number;
}

/**
 * Heuristic (days-to-sell-out vs. days-to-expiry), not ML — deliberate.
 * ARCHITECTURE.md pairs "Expiration Prediction" with XGBoost, implying a
 * trained model, but there are zero historical wastage/write-off labels
 * anywhere in the schema to train against (StockMovementType.WRITE_OFF
 * exists but nothing has ever populated it). This is the correct, honestly-
 * scoped MVP — an ML upgrade is real future work, not silently assumed done.
 */
export async function predictExpirationRisk(
  tx: TransactionClient,
  { storeId }: { storeId?: string } = {},
): Promise<ExpirationRisk[]> {
  const horizon = new Date(Date.now() + EXPIRY_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const batches = await tx.productBatch.findMany({
    where: {
      storeId,
      quantityRemaining: { gt: 0 },
      expirationDate: { not: null, lte: horizon },
      deletedAt: null,
    },
    include: { product: { select: { name: true } } },
  });

  const since = new Date(Date.now() - VELOCITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const risks: ExpirationRisk[] = [];

  for (const batch of batches) {
    if (!batch.expirationDate || !batch.storeId) continue;

    const sold = await tx.saleItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId: batch.productId,
        sale: { storeId: batch.storeId, status: "completed", createdAt: { gte: since } },
      },
    });
    const avgDailyVelocity = (sold._sum.quantity ?? 0) / VELOCITY_LOOKBACK_DAYS;
    const daysUntilExpiry = Math.max(
      0,
      Math.ceil((batch.expirationDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    // No sales velocity at all -> can't ever sell out -> always at risk,
    // represented as Infinity rather than a divide-by-zero NaN.
    const daysToSellOut = avgDailyVelocity > 0 ? batch.quantityRemaining / avgDailyVelocity : Infinity;

    if (daysToSellOut > daysUntilExpiry) {
      risks.push({
        batchId: batch.id,
        productId: batch.productId,
        productName: batch.product.name,
        storeId: batch.storeId,
        quantityRemaining: batch.quantityRemaining,
        expirationDate: batch.expirationDate,
        daysUntilExpiry,
        avgDailyVelocity,
        daysToSellOut,
      });
    }
  }

  return risks;
}

/** Explicit, tunable banded rule — not ML-derived. */
function suggestedMarkdownPct(daysUntilExpiry: number): number {
  if (daysUntilExpiry <= 3) return 50;
  if (daysUntilExpiry <= 7) return 30;
  if (daysUntilExpiry <= 14) return 15;
  return 10;
}

export async function generateWasteRecommendations(
  tx: TransactionClient,
  { storeId }: { storeId?: string } = {},
): Promise<{ created: number }> {
  const risks = await predictExpirationRisk(tx, { storeId });

  let created = 0;
  for (const risk of risks) {
    const markdownPct = suggestedMarkdownPct(risk.daysUntilExpiry);
    await tx.aiRecommendation.create({
      data: {
        storeId: risk.storeId,
        recommendationType: "waste_prevention",
        title: `Waste risk: ${risk.productName}`,
        description: `${risk.quantityRemaining} unit(s) expiring in ${risk.daysUntilExpiry} day(s), unlikely to sell out at current velocity.`,
        data: {
          productId: risk.productId,
          batchId: risk.batchId,
          quantityAtRisk: risk.quantityRemaining,
          daysUntilExpiry: risk.daysUntilExpiry,
          suggestedMarkdownPct: markdownPct,
        },
        priority: risk.daysUntilExpiry <= 3 ? "urgent" : "high",
      },
    });
    created++;
  }
  return { created };
}
