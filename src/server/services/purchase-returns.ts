import type { Prisma } from "@prisma/client";
import { InvalidReferenceError } from "./products";
import { InvalidReturnQuantityError } from "./returns";
import { recordStockMovement } from "./stock";
import type { CreatePurchaseReturnInput } from "@/lib/validators/purchasing";

type TransactionClient = Prisma.TransactionClient;

/**
 * `${deliveryNumber}-RET${n}` (n = count of prior returns against that
 * delivery, plus 1) — same "tie identity to the parent document" call
 * PHASE3_PURCHASING_PLAN.md already makes for deliveryNumber itself, rather
 * than adding a fifth Store counter field.
 */
async function nextReturnNumber(tx: TransactionClient, deliveryId: string, deliveryNumber: string) {
  const priorCount = await tx.purchaseReturn.count({ where: { originalDeliveryId: deliveryId } });
  return `${deliveryNumber}-RET${priorCount + 1}`;
}

/**
 * Modeled directly on Phase 2's returns.ts: validates each returned line
 * against that delivery item's quantityDelivered minus whatever's already
 * been returned against it (so a line can't be over-returned across
 * multiple partial requests), then records a RETURN_OUT stock movement per
 * line via the existing recordStockMovement.
 */
export async function createPurchaseReturn(
  tx: TransactionClient,
  poId: string,
  input: CreatePurchaseReturnInput,
  createdBy: string,
) {
  const [po, delivery] = await Promise.all([
    tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId } }),
    tx.purchaseDelivery.findUnique({
      where: { id: input.originalDeliveryId },
      include: { items: { include: { poItem: true, returnItems: true, product: true } } },
    }),
  ]);
  if (!delivery || delivery.poId !== poId) {
    throw new InvalidReferenceError("originalDeliveryId");
  }

  const deliveryItemById = new Map(delivery.items.map((item) => [item.id, item]));

  let totalRefunded = 0;
  const requestedSoFar = new Map<string, number>();
  const itemsData = input.items.map((item) => {
    const deliveryItem = deliveryItemById.get(item.deliveryItemId);
    if (!deliveryItem) throw new InvalidReferenceError("deliveryItemId");

    const alreadyReturned = deliveryItem.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    const priorInThisRequest = requestedSoFar.get(item.deliveryItemId) ?? 0;
    const remaining = deliveryItem.quantityDelivered - alreadyReturned - priorInThisRequest;
    if (item.quantity <= 0 || item.quantity > remaining) {
      throw new InvalidReturnQuantityError(
        `Cannot return ${item.quantity} of "${deliveryItem.product.name}" — only ${remaining} remaining from this delivery.`,
      );
    }
    requestedSoFar.set(item.deliveryItemId, priorInThisRequest + item.quantity);

    const unitCost = deliveryItem.unitCost ?? deliveryItem.poItem.unitPrice;
    totalRefunded += unitCost * item.quantity;

    return {
      deliveryItemId: deliveryItem.id,
      productId: deliveryItem.productId,
      quantity: item.quantity,
      unitCost,
      reason: item.reason ?? null,
    };
  });

  const returnNumber = await nextReturnNumber(tx, delivery.id, delivery.deliveryNumber);

  const purchaseReturn = await tx.purchaseReturn.create({
    data: {
      storeId: po.storeId,
      supplierId: po.supplierId,
      originalDeliveryId: delivery.id,
      returnNumber,
      reason: input.reason ?? null,
      totalRefunded,
      createdBy,
      items: { create: itemsData },
    },
    include: { items: { include: { product: true } } },
  });

  for (const item of itemsData) {
    await recordStockMovement(tx, {
      productId: item.productId,
      storeId: po.storeId,
      movementType: "RETURN_OUT",
      quantity: item.quantity,
      referenceId: purchaseReturn.id,
      referenceType: "purchase_return",
      createdBy,
    });
  }

  return purchaseReturn;
}

export async function listPurchaseReturns(tx: TransactionClient, poId: string) {
  return tx.purchaseReturn.findMany({
    where: { originalDelivery: { poId } },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}
