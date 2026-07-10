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
