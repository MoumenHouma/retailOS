import type { Prisma } from "@prisma/client";
import { recordStockMovement } from "./stock";
import type { CreateStockCountInput, StockCountListQuery } from "@/lib/validators/warehousing";

type TransactionClient = Prisma.TransactionClient;

export class InvalidCountStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCountStatusTransitionError";
  }
}

/** Same gapless-per-store-counter pattern as saleCounter/poCounter/transferCounter. */
async function nextCountNumber(tx: TransactionClient, storeId: string): Promise<string> {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { countCounter: { increment: 1 } },
    select: { countCounter: true },
  });
  return `CNT-${String(store.countCounter).padStart(6, "0")}`;
}

/**
 * Snapshots StockLevel.quantityOnHand into each line's systemQuantity at
 * creation time (so the count reflects a fixed point, not a moving target
 * while counting is in progress) — countedQuantity starts equal to it as a
 * placeholder until the counting screen overwrites each line with what was
 * physically found.
 */
export async function createStockCount(
  tx: TransactionClient,
  input: CreateStockCountInput,
  userId: string,
) {
  const levels = await tx.stockLevel.findMany({
    where: { storeId: input.storeId, productId: { in: input.productIds } },
    select: { productId: true, quantityOnHand: true },
  });
  const onHandByProduct = new Map(levels.map((l) => [l.productId, l.quantityOnHand]));

  const countNumber = await nextCountNumber(tx, input.storeId);

  return tx.stockCount.create({
    data: {
      storeId: input.storeId,
      countNumber,
      notes: input.notes ?? null,
      createdBy: userId,
      items: {
        create: input.productIds.map((productId) => {
          const systemQuantity = onHandByProduct.get(productId) ?? 0;
          return { productId, systemQuantity, countedQuantity: systemQuantity };
        }),
      },
    },
    include: { items: { include: { product: true } } },
  });
}

export async function updateCountItem(
  tx: TransactionClient,
  countId: string,
  itemId: string,
  countedQuantity: number,
) {
  const count = await tx.stockCount.findUniqueOrThrow({ where: { id: countId }, select: { status: true } });
  if (count.status !== "in_progress") {
    throw new InvalidCountStatusTransitionError("Only in-progress counts can have their lines edited.");
  }
  return tx.stockCountItem.update({ where: { id: itemId }, data: { countedQuantity } });
}

export async function submitCount(tx: TransactionClient, countId: string) {
  const count = await tx.stockCount.findUniqueOrThrow({ where: { id: countId } });
  if (count.status !== "in_progress") {
    throw new InvalidCountStatusTransitionError("Only in-progress counts can be submitted for review.");
  }
  return tx.stockCount.update({ where: { id: countId }, data: { status: "pending_review" } });
}

/**
 * For each line where difference !== 0, calls the existing
 * recordStockMovement with ADJUSTMENT_IN/ADJUSTMENT_OUT depending on the
 * sign — same shape adjustStock (Phase 1) already uses, notes stamped with
 * the count number for traceability.
 */
export async function approveCount(tx: TransactionClient, countId: string, approverId: string) {
  const count = await tx.stockCount.findUniqueOrThrow({
    where: { id: countId },
    include: { items: true },
  });
  if (count.status !== "pending_review") {
    throw new InvalidCountStatusTransitionError("Only counts pending review can be approved.");
  }

  for (const item of count.items) {
    if (item.difference !== 0) {
      await recordStockMovement(tx, {
        productId: item.productId,
        storeId: count.storeId,
        movementType: item.difference > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantity: Math.abs(item.difference),
        referenceId: count.id,
        referenceType: "stock_count",
        notes: `Stock count ${count.countNumber}`,
        createdBy: approverId,
      });
    }
  }

  await tx.stockCountItem.updateMany({ where: { countId }, data: { adjustmentStatus: "approved" } });

  return tx.stockCount.update({
    where: { id: countId },
    data: { status: "approved", completedAt: new Date(), approvedBy: approverId },
    include: { items: { include: { product: true } } },
  });
}

export async function cancelCount(tx: TransactionClient, countId: string) {
  const count = await tx.stockCount.findUniqueOrThrow({ where: { id: countId } });
  if (count.status === "approved" || count.status === "cancelled") {
    throw new InvalidCountStatusTransitionError("This count can no longer be cancelled.");
  }
  return tx.stockCount.update({ where: { id: countId }, data: { status: "cancelled" } });
}

export async function searchStockCounts(tx: TransactionClient, query: StockCountListQuery) {
  const { status, storeId, page, pageSize } = query;
  const where: Prisma.StockCountWhereInput = {
    ...(status ? { status } : {}),
    ...(storeId ? { storeId } : {}),
  };

  const [items, total] = await Promise.all([
    tx.stockCount.findMany({
      where,
      include: { store: true, items: true },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.stockCount.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getStockCountById(tx: TransactionClient, id: string) {
  return tx.stockCount.findUniqueOrThrow({
    where: { id },
    include: { store: true, items: { include: { product: true } } },
  });
}
