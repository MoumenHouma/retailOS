// Phase 6 Chunk D: error tracking. @sentry/nextjs no-ops when SENTRY_DSN is
// unset — this is standard SDK behavior, not a custom guard. Ships a real
// integration point activated by one env var in prod, whether pointed at
// Sentry SaaS, self-hosted Sentry, or GlitchTip (open-source, Sentry-API-
// compatible — see docs/admin-guide.md). Pairs with, doesn't replace,
// src/lib/logger.ts: logger = "what happened locally," Sentry = "alert
// someone."
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN || undefined,
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN || undefined,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const Sentry = await import("@sentry/nextjs");
  (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
};
