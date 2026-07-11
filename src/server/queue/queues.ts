import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

// Every export below used to be constructed eagerly at module scope, which
// meant simply *importing* this file (e.g. src/proxy.ts, on every single
// request) opened a Redis connection and four BullMQ Queue connections
// unconditionally — even in the desktop edition, where no Redis is bundled
// at all, and even for code paths that never touch a queue. Lazy singleton
// getters instead: importing this module now has zero side effects: nothing
// connects until something actually calls one of these functions.

export function getBullmqConnection(): ConnectionOptions {
  const parsedRedisUrl = new URL(process.env.REDIS_URL ?? "redis://redis:6379");
  // Plain connection options (host/port), not a shared IORedis instance —
  // bullmq bundles its own ioredis version internally, and passing an
  // externally-constructed IORedis instance can hit a structural type
  // mismatch across duplicate ioredis versions in the dependency tree (seen
  // live: `Property 'connecting' is protected...`). Passing options instead
  // lets bullmq construct its own compatible client per Queue/Worker.
  return {
    host: parsedRedisUrl.hostname,
    port: Number(parsedRedisUrl.port || 6379),
    maxRetriesPerRequest: null,
  };
}

// Separate raw ioredis client for our own pub/sub use (src/server/realtime/publish.ts)
// — unrelated to bullmq's internal connection, so no version-mismatch risk here.
let _redisConnection: IORedis | null = null;
export function getRedisConnection(): IORedis {
  if (!_redisConnection) {
    _redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return _redisConnection;
}

export interface ForecastJobData {
  tenantId: string;
  jobBatchId: string;
  productId: string;
  storeId: string;
  horizonDays: number;
}

let _forecastQueue: Queue<ForecastJobData> | null = null;
export function getForecastQueue(): Queue<ForecastJobData> {
  if (!_forecastQueue) {
    _forecastQueue = new Queue<ForecastJobData>("forecast", { connection: getBullmqConnection() });
  }
  return _forecastQueue;
}

// Chunk C (Supplier Ranking) and Chunk D (bulk scenario simulation) fill
// these in later — scaffolded now so docker-compose's `worker` service and
// this queue module don't need a second infra pass per chunk.
let _mcdaQueue: Queue | null = null;
export function getMcdaQueue(): Queue {
  if (!_mcdaQueue) {
    _mcdaQueue = new Queue("mcda", { connection: getBullmqConnection() });
  }
  return _mcdaQueue;
}

let _simulationQueue: Queue | null = null;
export function getSimulationQueue(): Queue {
  if (!_simulationQueue) {
    _simulationQueue = new Queue("simulation", { connection: getBullmqConnection() });
  }
  return _simulationQueue;
}

// Phase 6 Chunk A — the app's first repeatable/cron-based BullMQ job (every
// prior queue is one-shot). One repeatable job per ScheduledReport, keyed
// by its id so re-registering on every app boot is idempotent (BullMQ dedupes
// repeatable jobs by jobId + repeat pattern).
export interface ReportJobData {
  tenantId: string;
  scheduledReportId: string;
}

let _reportQueue: Queue<ReportJobData> | null = null;
export function getReportQueue(): Queue<ReportJobData> {
  if (!_reportQueue) {
    _reportQueue = new Queue<ReportJobData>("report", { connection: getBullmqConnection() });
  }
  return _reportQueue;
}

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
  await getReportQueue().upsertJobScheduler(
    scheduledReportId,
    { pattern: REPORT_CRON_PATTERNS[frequency] ?? REPORT_CRON_PATTERNS.daily },
    { data: { tenantId, scheduledReportId } },
  );
}

export async function unregisterReportSchedule(scheduledReportId: string) {
  await getReportQueue().removeJobScheduler(scheduledReportId);
}
