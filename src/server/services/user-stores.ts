import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class UserStoreAlreadyAssignedError extends Error {
  constructor() {
    super("User is already assigned to this store");
    this.name = "UserStoreAlreadyAssignedError";
  }
}

// UserStore creation was previously seed.ts-only — no UI/API path existed
// (flagged by Phase 3's own Dev Log: "worth a real 'add store' flow
// whenever multi-store becomes a first-class concern"). This closes that
// gap.
export async function assignUserToStore(tx: TransactionClient, userId: string, storeId: string) {
  const existing = await tx.userStore.findUnique({ where: { userId_storeId: { userId, storeId } } });
  if (existing) throw new UserStoreAlreadyAssignedError();
  return tx.userStore.create({ data: { userId, storeId } });
}

export async function revokeUserFromStore(tx: TransactionClient, userId: string, storeId: string) {
  await tx.userStore.deleteMany({ where: { userId, storeId } });
}

export async function listUserStores(tx: TransactionClient, userId: string) {
  return tx.userStore.findMany({
    where: { userId },
    include: { store: { select: { id: true, name: true, isMain: true } } },
  });
}
