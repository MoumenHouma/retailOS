import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { redisConnection } from "@/server/queue/queues";

// NOTE: combining next-auth v5's `auth()` HOC with next-intl's middleware
// here (the pattern both projects officially document) crashes the Edge
// runtime with this exact next-auth beta / next-intl / Next 16 combination
// ("Failed to proxy ... socket hang up", no catchable stack). Route
// protection is instead enforced in `(dashboard)/layout.tsx`, which calls
// `auth()` server-side and redirects unauthenticated users. Revisit
// middleware-level gating once the version incompatibility is resolved.
const intlMiddleware = createIntlMiddleware(routing);

// Phase 6 Chunk B: rate limiting. Next.js 16 only allows a single
// proxy/middleware file — this was briefly a separate `src/middleware.ts`
// (the pre-16 filename) until live verification caught "Both middleware
// file and proxy file are detected" crashing every route with a 404. Merged
// here instead. Proxy files always run on Node.js runtime in Next.js 16
// (needed anyway since ioredis requires Node's native `net` module) —
// declaring `runtime` explicitly is rejected at build time ("Route segment
// config is not allowed in Proxy file"), so only `matcher` is set here.
export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 10;
const DEFAULT_LIMIT = 120;

// Atomic INCR + conditional EXPIRE in one Redis round trip instead of two
// sequential ones (every /api/* request was paying 1-2 round trips here).
const INCR_AND_EXPIRE_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c
`;

async function checkRateLimit(key: string, limit: number): Promise<boolean> {
  const count = (await redisConnection.eval(
    INCR_AND_EXPIRE_SCRIPT,
    1,
    key,
    WINDOW_SECONDS,
  )) as number;
  return count <= limit;
}

async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/api/auth");
  const limit = isAuthRoute ? AUTH_LIMIT : DEFAULT_LIMIT;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const routePrefix = path.split("/").slice(0, 4).join("/");
  const key = `ratelimit:${ip}:${routePrefix}`;

  try {
    const allowed = await checkRateLimit(key, limit);
    if (!allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests." } },
        { status: 429 },
      );
    }
  } catch {
    // Redis unreachable — fail open rather than taking the whole API down
    // over a rate-limiter outage.
  }
  return null;
}

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    const limited = await rateLimit(request);
    return limited ?? NextResponse.next();
  }
  return intlMiddleware(request);
}
