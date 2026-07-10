import type { Session } from "next-auth";

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing required permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError (map to 403 in the route handler) if the session lacks `permission`. */
export function requirePermission(session: Session | null, permission: string): void {
  if (!session?.user.permissions.includes(permission)) {
    throw new ForbiddenError(permission);
  }
}

export class StoreAccessDeniedError extends Error {
  constructor() {
    super("You do not have access to this store.");
    this.name = "StoreAccessDeniedError";
  }
}

/**
 * Phase 6 Chunk C: store-level access control. Route-layer check, not
 * injected into withTenant globally — withTenant is called from 24+
 * store-scoped service files, so changing its signature to also carry
 * store-access logic is a far bigger blast radius than one explicit call
 * where storeId is already a known route param/body field. BUSINESS_OWNER
 * bypasses (sees every store in their tenant by definition, same posture as
 * ALL_PERMISSIONS); everyone else is checked against session.user.storeIds.
 */
export function requireStoreAccess(session: Session | null, storeId: string): void {
  if (!session) throw new StoreAccessDeniedError();
  if (session.user.roles.includes("BUSINESS_OWNER")) return;
  if (!session.user.storeIds.includes(storeId)) {
    throw new StoreAccessDeniedError();
  }
}
