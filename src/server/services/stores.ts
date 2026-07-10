import type { Prisma } from "@prisma/client";
import type { StoreCreate, StoreUpdate } from "@/lib/validators/stores";

type TransactionClient = Prisma.TransactionClient;

export class StoreNotFoundError extends Error {
  constructor() {
    super("Store not found");
    this.name = "StoreNotFoundError";
  }
}

export async function listStores(tx: TransactionClient) {
  return tx.store.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });
}

// Store.tenantId predates the dbgenerated-tenantId-default convention (a
// Phase 0 table, same posture as Role per Phase 4 Chunk D's own note) —
// threaded through explicitly from the session rather than relying on a
// column default. Reuses the same field set register.ts's tenant-creation
// transaction already writes, just without the tenant/roles/owner-user
// bootstrapping that only applies to the very first store.
export async function createStore(tx: TransactionClient, tenantId: string, input: StoreCreate) {
  return tx.store.create({
    data: { tenantId, ...input, isMain: false },
  });
}

export async function updateStore(tx: TransactionClient, id: string, input: StoreUpdate) {
  const existing = await tx.store.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new StoreNotFoundError();
  return tx.store.update({ where: { id }, data: input });
}

export async function softDeleteStore(tx: TransactionClient, id: string) {
  const existing = await tx.store.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new StoreNotFoundError();
  if (existing.isMain) {
    throw new Error("Cannot delete the tenant's main store.");
  }
  await tx.store.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}
