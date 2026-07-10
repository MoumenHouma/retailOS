import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

const parsedRedisUrl = new URL(process.env.REDIS_URL ?? "redis://redis:6379");

// Plain connection options (host/port), not a shared IORedis instance —
// bullmq bundles its own ioredis version internally, and passing an
// externally-constructed IORedis instance can hit a structural type
// mismatch across duplicate ioredis versions in the dependency tree (seen
// live: `Property 'connecting' is protected...`). Passing options instead
// lets bullmq construct its own compatible client per Queue/Worker.
export const bullmqConnection: ConnectionOptions = {
  host: parsedRedisUrl.hostname,
  port: Number(parsedRedisUrl.port || 6379),
  maxRetriesPerRequest: null,
};

// Separate raw ioredis client for our own pub/sub use (src/server/realtime/publish.ts)
// — unrelated to bullmq's internal connection, so no version-mismatch risk here.
export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

export interface ForecastJobData {
  tenantId: string;
  jobBatchId: string;
  productId: string;
  storeId: string;
  horizonDays: number;
}

export const forecastQueue = new Queue<ForecastJobData>("forecast", {
  connection: bullmqConnection,
});

// Chunk C (Supplier Ranking) and Chunk D (bulk scenario simulation) fill
// these in later — scaffolded now so docker-compose's `worker` service and
// this queue module don't need a second infra pass per chunk.
export const mcdaQueue = new Queue("mcda", { connection: bullmqConnection });
export const simulationQueue = new Queue("simulation", { connection: bullmqConnection });

// Phase 6 Chunk A — the app's first repeatable/cron-based BullMQ job (every
// prior queue is one-shot). One repeatable job per ScheduledReport, keyed
// by its id so re-registering on every app boot is idempotent (BullMQ dedupes
// repeatable jobs by jobId + repeat pattern).
export interface ReportJobData {
  tenantId: string;
  scheduledReportId: string;
}

export const reportQueue = new Queue<ReportJobData>("report", { connection: bullmqConnection });

const REPORT_CRON_PATTERNS: Record<string, string> = {
  daily: "0 6 * * *",
  weekly: "0 6 * * 1",
  monthly: "0 6 1 * *",
};

// Fixed tenant-local 06:00 run time per frequency — deliberately not
// user-configurable (roadmap says "generate and email," not "at a custom
// time"). upsertJobScheduler is idempotent on schedulerId, so calling this
// again after an update just replaces the existing schedule.
export async function registerReportSchedule(
  scheduledReportId: string,
  tenantId: string,
  frequency: string,
) {
  await reportQueue.upsertJobScheduler(
    scheduledReportId,
    { pattern: REPORT_CRON_PATTERNS[frequency] ?? REPORT_CRON_PATTERNS.daily },
    { data: { tenantId, scheduledReportId } },
  );
}

export async function unregisterReportSchedule(scheduledReportId: string) {
  await reportQueue.removeJobScheduler(scheduledReportId);
}
