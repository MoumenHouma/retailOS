import { NextResponse } from "next/server";
import { prismaSuperuser } from "@/lib/prisma";

// Phase 6 Chunk D: a real readiness probe, separate from /api/health (which
// is deliberately DB-free — the POS offline-sync heartbeat must stay
// reachable/fast even if the DB is briefly unhappy, so its contract isn't
// changed here). Used by scripts/deploy.sh's smoke-check and
// docker-compose.prod.yml's healthcheck.
export async function GET() {
  try {
    await prismaSuperuser.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
