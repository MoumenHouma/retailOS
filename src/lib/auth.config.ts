import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the NextAuth config — imported by `middleware.ts`,
 * which runs on the Edge runtime and cannot load Prisma. The Credentials
 * provider itself (which does need Prisma) lives in `lib/auth.ts` and is
 * only used by the Node-runtime route handler.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // 24h, matches JWT_EXPIRATION
  },
  cookies: {
    sessionToken: {
      name: "retailos-session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    authorized({ auth, request }) {
      const isDashboard = /^\/(fr|ar|en)\/(?!login|register)/.test(request.nextUrl.pathname);
      if (isDashboard) return Boolean(auth?.user);
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.roles = user.roles;
        token.permissions = user.permissions;
        // Phase 6 Chunk C: storeId -> storeIds — a multi-store user was
        // previously silently limited to one store for the whole session.
        // storeIds is the source of truth for access checks; primaryStoreId
        // is only a default for single-store-assuming call sites.
        token.storeIds = user.storeIds;
        token.primaryStoreId = user.primaryStoreId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.tenantId = token.tenantId as string;
      session.user.roles = token.roles as string[];
      session.user.permissions = token.permissions as string[];
      session.user.storeIds = token.storeIds as string[];
      session.user.primaryStoreId = token.primaryStoreId as string | null;
      return session;
    },
  },
  providers: [], // populated in lib/auth.ts (Node runtime only)
} satisfies NextAuthConfig;

// Edge-safe `auth()` — used by middleware.ts to check session presence only.
// Has no Credentials provider (that needs Prisma/bcryptjs, Node-only), which
// is fine here since middleware never signs in, only reads the JWT cookie.
export const { auth } = NextAuth(authConfig);
