/**
 * Standalone Socket.io realtime server. Next.js's App Router (Route
 * Handlers only, no custom server) has no supported way to host a
 * long-lived Socket.io server in-process, so this runs as its own
 * docker-compose service/process (see PHASE5_INTELLIGENCE_PLAN.md's
 * "New infra" section). Subscribes to Redis pub/sub so any process
 * (this Next.js app's API routes, the BullMQ worker) can trigger an
 * emission via publishTenantEvent() without holding a reference to this
 * server instance.
 */
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import IORedis from "ioredis";
import { jwtVerify } from "jose";
import { EVENTS_CHANNEL } from "@/server/realtime/publish";

const PORT = Number(process.env.REALTIME_PORT ?? 4001);
const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me");

const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379";
const pubClient = new IORedis(redisUrl);
const subClient = pubClient.duplicate();
const eventsSubscriber = pubClient.duplicate();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  // Phase 6 Chunk B: scoped to APP_URL per this comment's own original TODO.
  // Falls back to "*" only if APP_URL is unset (matches this file's prior
  // dev-only behavior rather than breaking local dev with no .env at all).
  cors: { origin: process.env.APP_URL ?? "*" },
  adapter: createAdapter(pubClient, subClient),
});

// Auth: the dashboard shell mints a short-lived JWT (signed with
// NEXTAUTH_SECRET) carrying the session's tenantId. Verifying it here and
// scoping the socket to room `tenant:{tenantId}` reimplements RLS's
// isolation guarantee at the socket layer, since Postgres RLS has no
// meaning for a WebSocket connection.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) throw new Error("Missing token");
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.tenantId !== "string") throw new Error("Missing tenantId claim");
    socket.data.tenantId = payload.tenantId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const tenantId = socket.data.tenantId as string;
  socket.join(`tenant:${tenantId}`);
});

eventsSubscriber.subscribe(EVENTS_CHANNEL);
eventsSubscriber.on("message", (channel, message) => {
  if (channel !== EVENTS_CHANNEL) return;
  try {
    const { tenantId, event, payload } = JSON.parse(message) as {
      tenantId: string;
      event: string;
      payload: unknown;
    };
    io.to(`tenant:${tenantId}`).emit(event, payload);
  } catch {
    // Malformed message on the shared channel — ignore rather than crash
    // the whole realtime process over one bad publish.
  }
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT}`);
});
