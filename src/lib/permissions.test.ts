import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { requirePermission, requireStoreAccess, ForbiddenError, StoreAccessDeniedError } from "./permissions";

function makeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    expires: new Date(Date.now() + 3600_000).toISOString(),
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      roles: [],
      permissions: [],
      storeIds: [],
      primaryStoreId: null,
      ...overrides,
    },
  };
}

describe("requirePermission", () => {
  it("throws ForbiddenError with the permission name when there is no session", () => {
    expect(() => requirePermission(null, "sales:create")).toThrow(ForbiddenError);
    expect(() => requirePermission(null, "sales:create")).toThrow(/sales:create/);
  });

  it("throws when the session is missing the permission", () => {
    const session = makeSession({ permissions: ["sales:read"] });
    expect(() => requirePermission(session, "sales:create")).toThrow(ForbiddenError);
  });

  it("does not throw when the session has the permission", () => {
    const session = makeSession({ permissions: ["sales:read", "sales:create"] });
    expect(() => requirePermission(session, "sales:create")).not.toThrow();
  });
});

describe("requireStoreAccess", () => {
  it("throws StoreAccessDeniedError when there is no session", () => {
    expect(() => requireStoreAccess(null, "store-1")).toThrow(StoreAccessDeniedError);
  });

  it("throws when a non-owner is not assigned to the store", () => {
    const session = makeSession({ roles: ["CASHIER"], storeIds: ["store-2"] });
    expect(() => requireStoreAccess(session, "store-1")).toThrow(StoreAccessDeniedError);
  });

  it("passes when a non-owner is assigned to the store", () => {
    const session = makeSession({ roles: ["CASHIER"], storeIds: ["store-1", "store-2"] });
    expect(() => requireStoreAccess(session, "store-1")).not.toThrow();
  });

  it("lets BUSINESS_OWNER bypass store assignment entirely", () => {
    const session = makeSession({ roles: ["BUSINESS_OWNER"], storeIds: [] });
    expect(() => requireStoreAccess(session, "any-store-not-assigned")).not.toThrow();
  });
});
