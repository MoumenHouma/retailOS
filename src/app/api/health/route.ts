import { NextResponse } from "next/server";

// Deliberately unauthenticated and DB-free — used by the POS offline-sync
// heartbeat to distinguish "reachable server" from navigator.onLine's
// unreliable signal (a device can report "online" while attached to a
// network with no real path to this server).
export async function GET() {
  return NextResponse.json({ ok: true });
}
