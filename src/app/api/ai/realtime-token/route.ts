import { SignJWT } from "jose";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-response";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me");

/**
 * Mints a short-lived JWT the browser hands to the standalone Socket.io
 * realtime server (src/server/realtime/server.ts) on connect. Postgres RLS
 * has no meaning for a WebSocket — this token, and the room join it drives,
 * is what keeps one tenant's events from reaching another tenant's browser.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user.tenantId) {
    return apiError("UNAUTHORIZED", "Not authenticated.", 401);
  }

  const token = await new SignJWT({ tenantId: session.user.tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return apiSuccess({ token });
}
