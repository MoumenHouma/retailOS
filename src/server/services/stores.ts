import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function listStores(tx: TransactionClient) {
  return tx.store.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
  });
}
