import type { Prisma } from "@prisma/client";
import { InvalidReferenceError } from "./products";
import { recordStockMovement } from "./stock";
import type {
  CreateStockTransferInput,
  ReceiveTransferInput,
  SendTransferInput,
  StockTransferListQuery,
} from "@/lib/validators/warehousing";

type TransactionClient = Prisma.TransactionClient;

export class InvalidTransferStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransferStatusTransitionError";
  }
}

export class InvalidTransferQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransferQuantityError";
  }
}

/**
 * Same gapless-per-store-counter pattern as saleCounter/poCounter — scoped
 * to the *source* store since that's the store initiating the transfer.
 */
async function nextTransferNumber(tx: TransactionClient, fromStoreId: string): Promise<string> {
  const store = await tx.store.update({
    where: { id: fromStoreId },
    data: { transferCounter: { increment: 1 } },
    select: { transferCounter: true },
  });
  return `TRF-${String(store.transferCounter).padStart(6, "0")}`;
}

export async function createTransfer(
  tx: TransactionClient,
  input: CreateStockTransferInput,
  userId: string,
) {
  if (input.fromStoreId === input.toStoreId) {
    throw new InvalidTransferQuantityError("A transfer must move stock between two different stores.");
  }
  const [fromStore, toStore] = await Promise.all([
    tx.store.findUnique({ where: { id: input.fromStoreId }, select: { id: true } }),
    tx.store.findUnique({ where: { id: input.toStoreId }, select: { id: true } }),
  ]);
  if (!fromStore) throw new InvalidReferenceError("fromStoreId");
  if (!toStore) throw new InvalidReferenceError("toStoreId");

  const transferNumber = await nextTransferNumber(tx, input.fromStoreId);

  return tx.stockTransfer.create({
    data: {
      transferNumber,
      fromStoreId: input.fromStoreId,
      toStoreId: input.toStoreId,
      notes: input.notes ?? null,
      createdBy: userId,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantityRequested: item.quantityRequested,
        })),
      },
    },
    include: { items: true, fromStore: true, toStore: true },
  });
}

/**
 * Lifecycle follows DATABASE.md's concrete enum order verbatim as the
 * linear happy path — there is no separate "approved" status value, so
 * approving a transfer moves it straight from draft to pending (approved,
 * awaiting dispatch), same class of "concrete enum wins" call Chunk A made
 * for PoStatus.
 */
export async function approveTransfer(tx: TransactionClient, id: string, approverId: string) {
  const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
  if (transfer.status !== "draft") {
    throw new InvalidTransferStatusTransitionError("Only draft transfers can be approved.");
  }
  return tx.stockTransfer.update({ where: { id }, data: { status: "pending", approvedBy: approverId } });
}

export async function cancelTransfer(tx: TransactionClient, id: string) {
  const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id } });
  if (transfer.status === "received" || transfer.status === "cancelled") {
    throw new InvalidTransferStatusTransitionError("This transfer can no longer be cancelled.");
  }
  return tx.stockTransfer.update({ where: { id }, data: { status: "cancelled" } });
}

export async function sendTransfer(
  tx: TransactionClient,
  id: string,
  input: SendTransferInput,
  userId: string,
) {
  const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (transfer.status !== "pending") {
    throw new InvalidTransferStatusTransitionError("Only pending transfers can be sent.");
  }
  const itemById = new Map(transfer.items.map((item) => [item.id, item]));

  for (const line of input.items) {
    const item = itemById.get(line.itemId);
    if (!item) throw new InvalidReferenceError("itemId");
    const quantitySent = line.quantitySent ?? item.quantityRequested;
    if (quantitySent <= 0 || quantitySent > item.quantityRequested) {
      throw new InvalidTransferQuantityError(
        `Cannot send ${quantitySent} — only ${item.quantityRequested} requested on this line.`,
      );
    }

    await recordStockMovement(tx, {
      productId: item.productId,
      storeId: transfer.fromStoreId,
      movementType: "TRANSFER_OUT",
      quantity: quantitySent,
      referenceId: transfer.id,
      referenceType: "stock_transfer",
      createdBy: userId,
    });
    await tx.stockTransferItem.update({ where: { id: item.id }, data: { quantitySent } });
  }

  return tx.stockTransfer.update({
    where: { id },
    data: { status: "in_transit" },
    include: { items: true },
  });
}

export async function receiveTransfer(
  tx: TransactionClient,
  id: string,
  input: ReceiveTransferInput,
  userId: string,
) {
  const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (transfer.status !== "in_transit") {
    throw new InvalidTransferStatusTransitionError("Only in-transit transfers can be received.");
  }
  const itemById = new Map(transfer.items.map((item) => [item.id, item]));

  for (const line of input.items) {
    const item = itemById.get(line.itemId);
    if (!item) throw new InvalidReferenceError("itemId");
    const quantityReceived = line.quantityReceived ?? item.quantitySent;
    if (quantityReceived <= 0 || quantityReceived > item.quantitySent) {
      throw new InvalidTransferQuantityError(
        `Cannot receive ${quantityReceived} — only ${item.quantitySent} sent on this line.`,
      );
    }

    await recordStockMovement(tx, {
      productId: item.productId,
      storeId: transfer.toStoreId,
      movementType: "TRANSFER_IN",
      quantity: quantityReceived,
      referenceId: transfer.id,
      referenceType: "stock_transfer",
      createdBy: userId,
    });
    await tx.stockTransferItem.update({ where: { id: item.id }, data: { quantityReceived } });
  }

  return tx.stockTransfer.update({
    where: { id },
    data: { status: "received", receivedBy: userId },
    include: { items: true },
  });
}

export async function searchTransfers(tx: TransactionClient, query: StockTransferListQuery) {
  const { status, storeId, page, pageSize } = query;
  const where: Prisma.StockTransferWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(storeId ? { OR: [{ fromStoreId: storeId }, { toStoreId: storeId }] } : {}),
  };

  const [items, total] = await Promise.all([
    tx.stockTransfer.findMany({
      where,
      include: { fromStore: true, toStore: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.stockTransfer.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getTransferById(tx: TransactionClient, id: string) {
  return tx.stockTransfer.findUniqueOrThrow({
    where: { id },
    include: { fromStore: true, toStore: true, items: { include: { product: true } } },
  });
}
