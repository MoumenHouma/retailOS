import type { Prisma } from "@prisma/client";
import type {
  CreateSupplierContactInput,
  CreateSupplierInput,
  LinkSupplierProductInput,
  SupplierSearchQuery,
  UpdateSupplierContactInput,
  UpdateSupplierInput,
  UpdateSupplierProductInput,
} from "@/lib/validators/suppliers";

type TransactionClient = Prisma.TransactionClient;

export async function searchSuppliers(tx: TransactionClient, query: SupplierSearchQuery) {
  const { q, city, wilaya, isActive, sort, order, page, pageSize } = query;

  const where: Prisma.SupplierWhereInput = {
    deletedAt: null,
    ...(city ? { city } : {}),
    ...(wilaya ? { wilaya } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { nif: q },
            { rc: q },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    tx.supplier.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.supplier.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createSupplier(tx: TransactionClient, input: CreateSupplierInput) {
  return tx.supplier.create({ data: input });
}

export async function updateSupplier(
  tx: TransactionClient,
  id: string,
  input: UpdateSupplierInput,
) {
  return tx.supplier.update({ where: { id }, data: input });
}

// Soft delete does not cascade to supplier_products/supplier_contacts —
// they remain as historical mapping data, visible on the supplier's own
// (now-inactive) detail page but hidden from active-supplier pickers.
export async function softDeleteSupplier(tx: TransactionClient, id: string): Promise<void> {
  await tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function addSupplierContact(
  tx: TransactionClient,
  supplierId: string,
  input: CreateSupplierContactInput,
) {
  if (input.isPrimary) {
    await tx.supplierContact.updateMany({ where: { supplierId }, data: { isPrimary: false } });
  }
  return tx.supplierContact.create({ data: { supplierId, ...input } });
}

export async function updateSupplierContact(
  tx: TransactionClient,
  supplierId: string,
  contactId: string,
  input: UpdateSupplierContactInput,
) {
  if (input.isPrimary) {
    await tx.supplierContact.updateMany({ where: { supplierId }, data: { isPrimary: false } });
  }
  return tx.supplierContact.update({ where: { id: contactId }, data: input });
}

export async function removeSupplierContact(tx: TransactionClient, contactId: string): Promise<void> {
  await tx.supplierContact.delete({ where: { id: contactId } });
}

/** isPreferred:true unsets it on all other suppliers linked to that product first. */
export async function linkSupplierProduct(
  tx: TransactionClient,
  supplierId: string,
  input: LinkSupplierProductInput,
) {
  if (input.isPreferred) {
    await tx.supplierProduct.updateMany({
      where: { productId: input.productId },
      data: { isPreferred: false },
    });
  }
  const existing = await tx.supplierProduct.findFirst({
    where: { supplierId, productId: input.productId },
  });
  if (existing) {
    return tx.supplierProduct.update({ where: { id: existing.id }, data: input });
  }
  return tx.supplierProduct.create({ data: { supplierId, ...input } });
}

export async function updateSupplierProduct(
  tx: TransactionClient,
  linkId: string,
  input: UpdateSupplierProductInput,
) {
  if (input.isPreferred) {
    const link = await tx.supplierProduct.findUniqueOrThrow({ where: { id: linkId } });
    await tx.supplierProduct.updateMany({
      where: { productId: link.productId, id: { not: linkId } },
      data: { isPreferred: false },
    });
  }
  return tx.supplierProduct.update({ where: { id: linkId }, data: input });
}

export async function removeSupplierProduct(tx: TransactionClient, linkId: string): Promise<void> {
  await tx.supplierProduct.delete({ where: { id: linkId } });
}

export interface SupplierPerformance {
  supplierId: string;
  leadTimeDays: number;
  rating: number | null;
  purchaseHistory: never[];
}

/**
 * Phase 1 placeholder: purchase_orders don't exist until Phase 3, so
 * purchaseHistory is always empty — not fabricated data. Shaped so the
 * Phase 3 implementation only needs to populate this array, not change the
 * response contract.
 */
export async function getSupplierPerformance(
  tx: TransactionClient,
  supplierId: string,
): Promise<SupplierPerformance> {
  const supplier = await tx.supplier.findUniqueOrThrow({
    where: { id: supplierId },
    select: { leadTimeDays: true, rating: true },
  });
  return {
    supplierId,
    leadTimeDays: supplier.leadTimeDays,
    rating: supplier.rating ? Number(supplier.rating) : null,
    purchaseHistory: [],
  };
}
