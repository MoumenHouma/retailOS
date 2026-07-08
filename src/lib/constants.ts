export const APP_NAME = "RetailOS";

export const DEFAULT_LOCALE = "fr";
export const DEFAULT_CURRENCY = "DZD";
export const DEFAULT_TVA_RATE = 19;

export const BCRYPT_SALT_ROUNDS = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// Phase 0 system roles. PLATFORM_ADMIN is deliberately excluded here — it is
// cross-tenant and roles.tenant_id is NOT NULL, so it needs a schema decision
// (nullable tenant_id or a sentinel platform tenant) deferred to a later phase.
export const SYSTEM_ROLES = [
  "BUSINESS_OWNER",
  "STORE_MANAGER",
  "CASHIER",
  "INVENTORY_CLERK",
  "ACCOUNTANT",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];
