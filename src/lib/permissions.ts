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
