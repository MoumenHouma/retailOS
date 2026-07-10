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
};

export default withNextIntl(nextConfig);
