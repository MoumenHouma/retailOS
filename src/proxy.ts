import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// NOTE: combining next-auth v5's `auth()` HOC with next-intl's middleware
// here (the pattern both projects officially document) crashes the Edge
// runtime with this exact next-auth beta / next-intl / Next 16 combination
// ("Failed to proxy ... socket hang up", no catchable stack). Route
// protection is instead enforced in `(dashboard)/layout.tsx`, which calls
// `auth()` server-side and redirects unauthenticated users. Revisit
// middleware-level gating once the version incompatibility is resolved.
export default createIntlMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and files with an extension (static assets).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
