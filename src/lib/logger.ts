/**
 * Hand-rolled structured logger — no new dependency, matching this repo's
 * low-dependency-footprint style. "Monitoring" for this phase is
 * `docker compose logs -f` + health-endpoint polling (see docs/admin-guide.md),
 * not a dashboard product; this just makes those log lines machine-parseable
 * JSON instead of free-text console.log calls.
 */
type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => {
    log("error", event, data);
    // Fire-and-forget, dynamic import so this file has zero cost when
    // @sentry/nextjs isn't installed/configured — logger = "what happened
    // locally," Sentry = "alert someone," different failure modes.
    if (process.env.SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((Sentry) => Sentry.captureMessage(event, { level: "error", extra: data }))
        .catch(() => {});
    }
  },
};
