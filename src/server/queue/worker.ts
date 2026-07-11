/**
 * BullMQ worker process — its own docker-compose service/container, not a
 * subprocess of the Next.js app. Registers job processors for every queue
 * in queues.ts. Chunk A only wires up `forecastQueue`; Chunks C/D fill in
 * `mcdaQueue`/`simulationQueue` later.
 */
import { Worker, type Job } from "bullmq";
import { getBullmqConnection, type ForecastJobData, type ReportJobData } from "@/server/queue/queues";
import { withTenant } from "@/lib/prisma";
import { exportSalesHistory } from "@/server/services/forecasting";
import { publishTenantEvent } from "@/server/realtime/publish";
import { recomputeProductOptimization } from "@/server/services/inventory-optimization";
import { generateReportForSchedule, recordScheduledReportRun } from "@/server/services/scheduled-reports";
import { sendEmail } from "@/lib/email";
import { uploadObject } from "@/lib/storage";
import { logger } from "@/lib/logger";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? "http://python-ai:8000";
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "dev-internal-token";

// ~2 years of daily history — plenty for Prophet's yearly seasonality
// without unbounded growth as a tenant's sales history accumulates.
const HISTORY_WINDOW_DAYS = 730;

interface PythonForecastResponse {
  modelUsed: string;
  modelVersion: string;
  predictions: {
    date: string;
    predictedQuantity: number;
    predictedLower: number;
    predictedUpper: number;
  }[];
}

async function processForecastJob(job: Job<ForecastJobData>) {
  const { tenantId, productId, storeId, horizonDays } = job.data;

  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Short read-only transaction, closed before the slow Python call — per
  // the Phase 4 Chunk C P2028 lesson, a withTenant transaction must never
  // be held open across a slow external HTTP call.
  const history = await withTenant(tenantId, (tx) =>
    exportSalesHistory(tx, { productId, storeId, from, to }),
  );

  if (history.length < 2) {
    // Not enough data to fit anything — skip quietly rather than fail the
    // batch; a product/store pair with under 2 days of sales history just
    // doesn't get a forecast yet.
    return { skipped: true, reason: "insufficient_history" };
  }

  const response = await fetch(`${AI_ENGINE_URL}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${INTERNAL_TOKEN}` },
    body: JSON.stringify({ productId, storeId, history, horizonDays }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Python forecast call failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as PythonForecastResponse;

  // New, separate transaction for the write side.
  await withTenant(tenantId, async (tx) => {
    for (const point of result.predictions) {
      const forecastDate = new Date(point.date);
      await tx.demandForecast.upsert({
        where: {
          tenantId_productId_storeId_forecastDate: { tenantId, productId, storeId, forecastDate },
        },
        create: {
          productId,
          storeId,
          forecastDate,
          predictedQuantity: Math.round(point.predictedQuantity),
          predictedLower: Math.round(point.predictedLower),
          predictedUpper: Math.round(point.predictedUpper),
          modelUsed: result.modelUsed,
          modelVersion: result.modelVersion,
        },
        update: {
          predictedQuantity: Math.round(point.predictedQuantity),
          predictedLower: Math.round(point.predictedLower),
          predictedUpper: Math.round(point.predictedUpper),
          modelUsed: result.modelUsed,
          modelVersion: result.modelVersion,
          // Stale after a re-run — reconcileForecastAccuracy recomputes it.
          accuracyMape: null,
        },
      });
    }
  });

  // Chunk B: a forecast completing is exactly the right moment to recompute
  // reorder point/safety stock/EOQ off of it — chained here rather than a
  // separate trigger, batch/on-demand either way (never on the hot POS path).
  await withTenant(tenantId, (tx) => recomputeProductOptimization(tx, { productId, storeId }));

  await publishTenantEvent(tenantId, "ai:recommendation", {
    type: "forecast_ready",
    productId,
    storeId,
    jobBatchId: job.data.jobBatchId,
  });

  return { predictionCount: result.predictions.length };
}

const forecastWorker = new Worker<ForecastJobData>("forecast", processForecastJob, {
  connection: getBullmqConnection(),
  // Prophet fitting is CPU-bound inside the single python-ai container —
  // a handful of concurrent HTTP calls is enough without saturating it.
  concurrency: 3,
});

forecastWorker.on("completed", (job) => {
  console.log(`[worker] forecast job ${job.id} completed`);
});
forecastWorker.on("failed", (job, err) => {
  console.error(`[worker] forecast job ${job?.id} failed:`, err);
});

console.log("[worker] forecastQueue worker started");

/**
 * Scheduled-report job: short read tx to generate the report data → close it
 * → upload + email (both external I/O) outside any transaction → new short
 * tx to record the run status. Same discipline as processForecastJob, per
 * the Phase 4 Chunk C P2028 lesson (never hold withTenant open across slow
 * external calls).
 */
async function processReportJob(job: Job<ReportJobData>) {
  const { tenantId, scheduledReportId } = job.data;

  const scheduledReport = await withTenant(tenantId, (tx) =>
    tx.scheduledReport.findFirst({ where: { id: scheduledReportId, deletedAt: null, isActive: true } }),
  );
  if (!scheduledReport) {
    return { skipped: true, reason: "not_found_or_inactive" };
  }

  try {
    const generated = await withTenant(tenantId, (tx) => generateReportForSchedule(tx, scheduledReport));

    const objectName = `reports/${tenantId}/${scheduledReport.id}/${generated.filename}`;
    await uploadObject(objectName, generated.buffer, generated.contentType);

    await sendEmail({
      to: scheduledReport.recipientEmails,
      subject: `RetailOS — ${scheduledReport.name}`,
      html: `<p>Votre rapport programmé « ${scheduledReport.name} » est joint à cet e-mail.</p>`,
      attachments: [{ filename: generated.filename, content: generated.buffer }],
    });

    await withTenant(tenantId, (tx) => recordScheduledReportRun(tx, scheduledReport.id, "success"));
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await withTenant(tenantId, (tx) => recordScheduledReportRun(tx, scheduledReport.id, "failed", message));
    throw error;
  }
}

const reportWorker = new Worker<ReportJobData>("report", processReportJob, {
  connection: getBullmqConnection(),
  concurrency: 2,
});

reportWorker.on("completed", (job) => {
  logger.info("worker.report_completed", { jobId: job.id });
});
reportWorker.on("failed", (job, err) => {
  logger.error("worker.report_failed", { jobId: job?.id, error: err.message });
});

console.log("[worker] reportQueue worker started");
