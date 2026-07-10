import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    tenantId: string;
    roles: string[];
    permissions: string[];
    // Phase 6 Chunk C: every store the user is assigned to (was storeId,
    // silently limited to the first UserStore row). storeIds is the source
    // of truth for access checks; primaryStoreId is a display/default-only
    // convenience for the few call sites that need one store to preselect.
    storeIds: string[];
    primaryStoreId: string | null;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
      storeIds: string[];
      primaryStoreId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    roles: string[];
    permissions: string[];
    storeIds: string[];
    primaryStoreId: string | null;
  }
}
