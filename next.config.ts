import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // next-intl@3.26's plugin injects the `next-intl/config` resolve alias
  // under `experimental.turbo` (Turbopack's pre-Next-16 config location).
  // Next 16 moved that to a top-level `turbopack` key and silently drops
  // the unrecognized `experimental.turbo` key, so under Turbopack (now
  // dev's default per docker-compose.yml) `getMessages()` couldn't resolve
  // `next-intl/config` and every locale route 500'd. Set the alias
  // ourselves until next-intl ships Next-16-native Turbopack support.
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
  // bullmq/ioredis use Node-native APIs (dynamic requires, native bindings
  // via ioredis' optional deps) that Next's bundler doesn't need to touch —
  // API routes importing src/server/queue/queues.ts already run in the Node
  // runtime, so externalizing just avoids bundling churn, not a runtime fix.
  serverExternalPackages: ["bullmq", "ioredis"],
  // Phase 6 Chunk B: security headers. CSP allows 'unsafe-inline' for
  // script-src (next-themes injects a small inline script pre-hydration to
  // avoid a light/dark flash) and style-src (every dropdown/select/dialog in
  // this app is a Radix primitive, which sets inline `style.transform` for
  // floating-element positioning — a strict style-src without it breaks
  // every popover in the app). A nonce-based CSP would tighten this further
  // but needs per-request header generation via middleware; documented
  // trade-off, not an oversight. connect-src includes NEXT_PUBLIC_REALTIME_URL
  // so the Socket.io client (src/hooks/use-ai-notifications.ts) isn't blocked.
  //
  // 'unsafe-eval' is added to script-src in dev only: Turbopack/React's dev
  // runtime uses eval() for HMR and component-stack reconstruction (surfaced
  // as a hard page-load error — "eval() is not supported... make sure
  // unsafe-eval is included" — once dev switched off --webpack, since
  // Turbopack's dev runtime hits this path harder/earlier than webpack's
  // did). Production never needs it — React explicitly documents it never
  // calls eval() outside dev mode — so prod keeps the strict policy.
  async headers() {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";
    const realtimeWsUrl = realtimeUrl.replace(/^http/, "ws");
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${realtimeUrl} ${realtimeWsUrl}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
