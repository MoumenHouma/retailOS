import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    tenantId: string;
    roles: string[];
    permissions: string[];
    storeId: string | null;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
      storeId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    roles: string[];
    permissions: string[];
    storeId: string | null;
  }
}
