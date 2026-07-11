import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { getForecastQueue, type ForecastJobData } from "@/server/queue/queues";

type TransactionClient = Prisma.TransactionClient;

export interface SalesHistoryPoint {
  date: string; // YYYY-MM-DD
  quantity: number;
}

/**
 * Groups completed sale-item quantities by day for one (product, store) pair.
 * A few years of daily history is at most a few thousand rows — sent inline
 * in the job's HTTP body to Python, no MinIO staging needed at this scale
 * (see PHASE5_INTELLIGENCE_PLAN.md's "New infra" section).
 */
export async function exportSalesHistory(
  tx: TransactionClient,
  { productId, storeId, from, to }: { productId: string; storeId: string; from: Date; to: Date },
): Promise<SalesHistoryPoint[]> {
  const rows = await tx.$queryRaw<{ date: Date; quantity: bigint }[]>`
    SELECT DATE("s"."created_at") AS date, SUM("si"."quantity") AS quantity
    FROM "sale_items" "si"
    JOIN "sales" "s" ON "s"."id" = "si"."sale_id"
    WHERE "si"."product_id" = ${productId}::uuid
      AND "s"."store_id" = ${storeId}::uuid
      AND "s"."status" = 'completed'
      AND "s"."created_at" >= ${from}
      AND "s"."created_at" <= ${to}
    GROUP BY DATE("s"."created_at")
    ORDER BY date ASC
  `;
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    quantity: Number(r.quantity),
  }));
}

/** Lists forecast points for one (product, store) pair, oldest first. */
export async function listForecasts(
  tx: TransactionClient,
  { productId, storeId }: { productId: string; storeId: string },
) {
  return tx.demandForecast.findMany({
    where: { productId, storeId },
    orderBy: { forecastDate: "asc" },
    select: {
      forecastDate: true,
      predictedQuantity: true,
      predictedLower: true,
      predictedUpper: true,
      accuracyMape: true,
    },
  });
}

export class NoActiveScopeError extends Error {
  constructor() {
    super("No active products/stores found to forecast for the given scope.");
    this.name = "NoActiveScopeError";
  }
}

/**
 * Enqueues one forecastQueue job per (product, store) pair in scope. When
 * productId/storeId aren't given, scopes to every active, trackable product
 * across every active store — same "batch over the tenant's whole catalog"
 * shape Phase 4's report functions use.
 */
export async function triggerForecastRun(
  tx: TransactionClient,
  tenantId: string,
  { productId, storeId, horizonDays }: { productId?: string; storeId?: string; horizonDays: number },
): Promise<{ jobBatchId: string; jobCount: number }> {
  const products = await tx.product.findMany({
    where: { id: productId, isActive: true, isTrackable: true },
    select: { id: true },
  });
  const stores = await tx.store.findMany({
    where: { id: storeId, isActive: true },
    select: { id: true },
  });
  if (products.length === 0 || stores.length === 0) {
    throw new NoActiveScopeError();
  }

  const jobBatchId = randomUUID();
  const jobs: { name: "forecast"; data: ForecastJobData }[] = [];
  for (const product of products) {
    for (const store of stores) {
      jobs.push({
        name: "forecast",
        data: { tenantId, jobBatchId, productId: product.id, storeId: store.id, horizonDays },
      });
    }
  }
  await getForecastQueue().addBulk(jobs);

  return { jobBatchId, jobCount: jobs.length };
}

/**
 * Aggregate BullMQ job states for a batch, polled by the frontend. Filters
 * by tenantId too (not just jobBatchId) — BullMQ has no native tenant
 * concept, so this is the only thing stopping one tenant from polling
 * another's (unguessable, but not secret-by-design) batch id.
 */
export async function getForecastBatchStatus(
  tenantId: string,
  jobBatchId: string,
): Promise<{ queued: number; active: number; completed: number; failed: number; total: number }> {
  const jobs = await getForecastQueue().getJobs(["waiting", "active", "completed", "failed", "delayed"]);
  const batchJobs = jobs.filter(
    (job) => job.data.jobBatchId === jobBatchId && job.data.tenantId === tenantId,
  );

  const counts = { queued: 0, active: 0, completed: 0, failed: 0, total: batchJobs.length };
  for (const job of batchJobs) {
    const state = await job.getState();
    if (state === "waiting" || state === "delayed") counts.queued++;
    else if (state === "active") counts.active++;
    else if (state === "completed") counts.completed++;
    else if (state === "failed") counts.failed++;
  }
  return counts;
}

/**
 * Pure TS/Postgres MAPE calculation against actual sale quantities — no
 * ML library needed for a subtraction and a division over already-scoped
 * rows. On-demand admin action, same "batch/on-demand, no scheduler infra
 * exists yet" precedent as Phase 4 Chunk D's commission calculation.
 */
export async function reconcileForecastAccuracy(
  tx: TransactionClient,
  { date }: { date: Date },
): Promise<{ reconciled: number }> {
  const forecasts = await tx.demandForecast.findMany({
    where: { forecastDate: date, accuracyMape: null },
  });

  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  let reconciled = 0;
  for (const forecast of forecasts) {
    const actual = await tx.saleItem.aggregate({
      _sum: { quantity: true },
      where: {
        productId: forecast.productId,
        sale: { storeId: forecast.storeId, status: "completed", createdAt: { gte: dayStart, lt: dayEnd } },
      },
    });
    const actualQuantity = actual._sum.quantity ?? 0;
    // Standard MAPE convention: undefined (skip) when actual demand was 0,
    // since dividing by zero is meaningless, not "infinitely wrong."
    if (actualQuantity === 0) continue;

    const mape =
      (Math.abs(actualQuantity - forecast.predictedQuantity) / actualQuantity) * 100;
    await tx.demandForecast.update({
      where: { id: forecast.id },
      data: { accuracyMape: Math.round(mape * 100) / 100 },
    });
    reconciled++;
  }
  return { reconciled };
}
