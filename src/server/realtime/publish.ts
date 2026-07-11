import { getRedisConnection } from "@/server/queue/queues";

const EVENTS_CHANNEL = "ai:events";

/**
 * The one function every job handler / API route calls to push an
 * unsolicited realtime notification. Publishes to Redis rather than holding
 * a reference to the standalone Socket.io server (src/server/realtime/server.ts)
 * — any process (this Next.js app, the worker) can call this without knowing
 * where/whether a realtime server instance is running.
 */
export async function publishTenantEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await getRedisConnection().publish(EVENTS_CHANNEL, JSON.stringify({ tenantId, event, payload }));
}

export { EVENTS_CHANNEL };
