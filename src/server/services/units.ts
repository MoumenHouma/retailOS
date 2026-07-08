import type { Prisma } from "@prisma/client";
import type { CreateUnitInput, UpdateUnitInput } from "@/lib/validators/products";
import { InUseError } from "./brands";

type TransactionClient = Prisma.TransactionClient;

export async function listUnits(tx: TransactionClient) {
  return tx.unit.findMany({
    where: { deletedAt: null },
    orderBy: [{ isBaseUnit: "desc" }, { name: "asc" }],
  });
}

export async function createUnit(tx: TransactionClient, input: CreateUnitInput) {
  return tx.unit.create({ data: input });
}

export async function updateUnit(tx: TransactionClient, id: string, input: UpdateUnitInput) {
  return tx.unit.update({ where: { id }, data: input });
}

/** Units are a NOT NULL FK on products — deletion must always be blocked if referenced. */
export async function deleteUnit(tx: TransactionClient, id: string): Promise<void> {
  const count = await tx.product.count({ where: { unitId: id, deletedAt: null } });
  if (count > 0) {
    throw new InUseError("Unit", count);
  }
  await tx.unit.update({ where: { id }, data: { deletedAt: new Date() } });
}
