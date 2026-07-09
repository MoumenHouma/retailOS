import type { Prisma } from "@prisma/client";
import { InvalidReferenceError } from "./products";
import { InvalidPoStatusTransitionError } from "./purchase-orders";
import { recordStockMovement } from "./stock";
import type { ReceiveDeliveryInput } from "@/lib/validators/purchasing";

type TransactionClient = Prisma.TransactionClient;

export class InvalidDeliveryQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDeliveryQuantityError";
  }
}

/**
 * `${poNumber}-R${n}` (n = count of prior deliveries against that PO, plus
 * 1) rather than a new Store counter field — ties a delivery's identity
 * directly to its PO, same call PHASE3_PURCHASING_PLAN.md makes explicitly.
 */
async function nextDeliveryNumber(
  tx: TransactionClient,
  poId: string,
  poNumber: string,
): Promise<string> {
  const priorCount = await tx.purchaseDelivery.count({ where: { poId } });
  return `${poNumber}-R${priorCount + 1}`;
}

/**
 * Receives a delivery against an `ordered`/`partially_received` PO. For
 * each line: creates a ProductBatch first when an expirationDate is given
 * (batchNumber falls back to a delivery-line-scoped label if the caller
 * left it blank, since ProductBatch.batchNumber is NOT NULL), then calls
 * the existing recordStockMovement — the only function permitted to write
 * stock_movements, same rule every prior chunk's stock-writing path
 * follows. Rolls the parent PurchaseOrder's status forward once all lines
 * are accounted for.
 */
export async function receiveDelivery(
  tx: TransactionClient,
  poId: string,
  input: ReceiveDeliveryInput,
  receivedBy: string,
) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { items: true },
  });
  if (po.status !== "ordered" && po.status !== "partially_received") {
    throw new InvalidPoStatusTransitionError(
      "Only ordered or partially-received purchase orders can receive a delivery.",
    );
  }

  const poItemById = new Map(po.items.map((item) => [item.id, item]));

  // Guard against over-receiving a line, including across multiple lines in
  // the same request that both target the same poItemId.
  const requestedByPoItem = new Map<string, number>();
  for (const item of input.items) {
    const poItem = poItemById.get(item.poItemId);
    if (!poItem) throw new InvalidReferenceError("poItemId");

    const requestedSoFar = requestedByPoItem.get(item.poItemId) ?? 0;
    const remaining = poItem.quantityOrdered - poItem.quantityReceived - requestedSoFar;
    if (item.quantityDelivered > remaining) {
      throw new InvalidDeliveryQuantityError(
        `Cannot receive ${item.quantityDelivered} — only ${remaining} still outstanding on this line.`,
      );
    }
    requestedByPoItem.set(item.poItemId, requestedSoFar + item.quantityDelivered);
  }

  const deliveryNumber = await nextDeliveryNumber(tx, poId, po.poNumber);

  const delivery = await tx.purchaseDelivery.create({
    data: {
      poId,
      deliveryNumber,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : new Date(),
      receivedBy,
      notes: input.notes ?? null,
    },
  });

  for (const [index, item] of input.items.entries()) {
    const poItem = poItemById.get(item.poItemId)!;
    const unitCost = item.unitCost ?? poItem.unitPrice;

    let batchId: string | null = null;
    if (item.expirationDate) {
      const batch = await tx.productBatch.create({
        data: {
          productId: poItem.productId,
          batchNumber: item.batchNumber ?? `${deliveryNumber}-L${index + 1}`,
          expirationDate: new Date(item.expirationDate),
          quantityReceived: item.quantityDelivered,
          quantityRemaining: item.quantityDelivered,
          unitCost,
          supplierId: po.supplierId,
          storeId: po.storeId,
        },
      });
      batchId = batch.id;
    }

    await tx.purchaseDeliveryItem.create({
      data: {
        deliveryId: delivery.id,
        poItemId: item.poItemId,
        productId: poItem.productId,
        quantityDelivered: item.quantityDelivered,
        batchNumber: item.batchNumber ?? null,
        expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
        unitCost,
      },
    });

    await recordStockMovement(tx, {
      productId: poItem.productId,
      storeId: po.storeId,
      movementType: "PURCHASE_IN",
      quantity: item.quantityDelivered,
      referenceId: delivery.id,
      referenceType: "purchase_delivery",
      batchId,
      createdBy: receivedBy,
    });

    await tx.purchaseOrderItem.update({
      where: { id: item.poItemId },
      data: { quantityReceived: { increment: item.quantityDelivered } },
    });
  }

  const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
  const allReceived = updatedItems.every((item) => item.quantityReceived >= item.quantityOrdered);
  await tx.purchaseOrder.update({
    where: { id: poId },
    data: { status: allReceived ? "received" : "partially_received" },
  });

  return tx.purchaseDelivery.findUniqueOrThrow({
    where: { id: delivery.id },
    include: { items: { include: { product: true } } },
  });
}

export async function listDeliveries(tx: TransactionClient, poId: string) {
  return tx.purchaseDelivery.findMany({
    where: { poId },
    include: {
      items: { include: { product: true, returnItems: true } },
      receivedByUser: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
