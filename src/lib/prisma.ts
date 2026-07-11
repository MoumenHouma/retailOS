import { PrismaClient, type Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  var __retailosPrismaApp: PrismaClient | undefined;
  var __retailosPrismaSuperuser: PrismaClient | undefined;
}

// RLS-restricted client (connects as `app_user`). Used directly only for
// queries that are intentionally unscoped — RLS's fail-closed default blocks
// all rows on tenant-scoped tables when app.current_tenant_id isn't set. For
// tenant-scoped access, use `withTenant()` below instead.
export const prisma =
  globalThis.__retailosPrismaApp ??
  new PrismaClient({ datasourceUrl: process.env.DATABASE_APP_URL });

// Superuser client (connects as `postgres`, bypasses RLS entirely). Only for
// operations that legitimately span tenants or run before a tenant exists:
// tenant registration (api/auth/register) and the seed script.
export const prismaSuperuser =
  globalThis.__retailosPrismaSuperuser ??
  new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalThis.__retailosPrismaApp = prisma;
  globalThis.__retailosPrismaSuperuser = prismaSuperuser;
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Runs `fn` inside a transaction on the RLS-restricted `app_user` connection
 * with `app.current_tenant_id` set to `tenantId` for its duration. Every
 * query `fn` makes via the provided `tx` client is scoped by Postgres RLS to
 * this tenant.
 *
 * NOTE: an earlier version threaded the tenant id through an ambient
 * `AsyncLocalStorage` context read by a `$extends` query middleware, so
 * callers could use the plain `prisma` client without threading `tx`
 * through. That silently returned empty results for every query: Prisma's
 * lazily-evaluated `PrismaPromise` defers actual execution in a way that
 * does not reliably propagate `AsyncLocalStorage` context to the
 * middleware. Passing `tx` explicitly avoids relying on that propagation.
 */
export function withTenant<T>(
  tenantId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }
  return prisma.$transaction(
    async (tx) => {
      // SET LOCAL doesn't support parameterized placeholders, hence the
      // interpolation — safe here only because tenantId is validated above
      // and always sourced from the server-verified session, never directly
      // from client input.
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      return fn(tx);
    },
    // Default Prisma transaction timeout is 5s — too tight for the heavier
    // report services (5-8 sequential reads) and was already producing
    // P2028 timeout errors (see Dev Log). maxWait bounds how long we queue
    // for a pool connection before giving up.
    { timeout: 15_000, maxWait: 10_000 },
  );
}
