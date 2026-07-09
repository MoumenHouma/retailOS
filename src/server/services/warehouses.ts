import type { Prisma } from "@prisma/client";
import { InUseError } from "./brands";
import type {
  CreateWarehouseBinInput,
  CreateWarehouseInput,
  CreateWarehouseZoneInput,
  UpdateWarehouseBinInput,
  UpdateWarehouseInput,
  UpdateWarehouseZoneInput,
} from "@/lib/validators/warehousing";

type TransactionClient = Prisma.TransactionClient;

export async function listWarehouses(tx: TransactionClient, storeId?: string) {
  return tx.warehouse.findMany({
    where: { deletedAt: null, ...(storeId ? { storeId } : {}) },
    include: { store: true },
    orderBy: { name: "asc" },
  });
}

export async function createWarehouse(tx: TransactionClient, input: CreateWarehouseInput) {
  return tx.warehouse.create({ data: input });
}

export async function updateWarehouse(tx: TransactionClient, id: string, input: UpdateWarehouseInput) {
  return tx.warehouse.update({ where: { id }, data: input });
}

export async function deleteWarehouse(tx: TransactionClient, id: string): Promise<void> {
  const count = await tx.warehouseZone.count({ where: { warehouseId: id, deletedAt: null } });
  if (count > 0) {
    throw new InUseError("Warehouse", count);
  }
  await tx.warehouse.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function listZones(tx: TransactionClient, warehouseId: string) {
  return tx.warehouseZone.findMany({
    where: { warehouseId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createZone(tx: TransactionClient, input: CreateWarehouseZoneInput) {
  return tx.warehouseZone.create({ data: input });
}

export async function updateZone(tx: TransactionClient, id: string, input: UpdateWarehouseZoneInput) {
  return tx.warehouseZone.update({ where: { id }, data: input });
}

export async function deleteZone(tx: TransactionClient, id: string): Promise<void> {
  const count = await tx.warehouseBin.count({ where: { zoneId: id, deletedAt: null } });
  if (count > 0) {
    throw new InUseError("Zone", count);
  }
  await tx.warehouseZone.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function listBins(tx: TransactionClient, zoneId: string) {
  return tx.warehouseBin.findMany({
    where: { zoneId, deletedAt: null },
    orderBy: { code: "asc" },
  });
}

export async function createBin(tx: TransactionClient, input: CreateWarehouseBinInput) {
  return tx.warehouseBin.create({ data: input });
}

export async function updateBin(tx: TransactionClient, id: string, input: UpdateWarehouseBinInput) {
  return tx.warehouseBin.update({ where: { id }, data: input });
}

export async function deleteBin(tx: TransactionClient, id: string): Promise<void> {
  await tx.warehouseBin.update({ where: { id }, data: { deletedAt: new Date() } });
}
