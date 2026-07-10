import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
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
  async headers() {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";
    const realtimeWsUrl = realtimeUrl.replace(/^http/, "ws");
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
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
