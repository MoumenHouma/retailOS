import { NextResponse } from "next/server";

// Server-only var, deliberately not NEXT_PUBLIC_* — the desktop packaging
// build reuses the exact same `.next/standalone` artifact as the hosted web
// app (see desktop/scripts/prepare-resources.mjs), selected at spawn time by
// the Tauri host setting this env var on the Node sidecar process. A
// NEXT_PUBLIC_ var would get inlined at build time instead, forcing a
// second build pipeline for no reason — every gate this flag drives only
// needs to be checked in server components / route handlers.
export function isDesktopEdition(): boolean {
  return process.env.RETAILOS_EDITION === "desktop";
}

/**
 * Response for AI/report-scheduling API routes when hit directly in the
 * desktop edition, where none of Redis/BullMQ/python-ai are bundled.
 * Defense-in-depth alongside hiding the nav entries — a stale bookmark or
 * hand-crafted request shouldn't hang or 500.
 */
export function desktopNotAvailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "NOT_AVAILABLE_IN_DESKTOP",
        message: "This feature isn't available in the desktop edition.",
      },
    },
    { status: 404 },
  );
}
