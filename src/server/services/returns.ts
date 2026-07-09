import type { Prisma } from "@prisma/client";
import { recordStockMovement } from "./stock";
import { InvalidReferenceError } from "./products";

type TransactionClient = Prisma.TransactionClient;

export class InvalidReturnQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReturnQuantityError";
  }
}

interface ReturnItemInput {
  saleItemId: string;
  quantity: number;
  reason?: string | null;
}

interface CreateReturnInput {
  storeId: string;
  originalSaleId: string;
  reason?: string | null;
  items: ReturnItemInput[];
  createdBy: string;
}

/**
 * Shares Store.saleCounter with sales — a return is just a different kind
 * of till document, and it still needs a legible sequential number. Reusing
 * the counter (rather than adding a second one) means sale and return
 * numbers interleave in issue order; the "-RET-" segment disambiguates
 * which is which, and nothing depends on either sequence being contiguous
 * on its own.
 */
async function nextReturnNumber(tx: TransactionClient, storeId: string): Promise<string> {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { saleCounter: { increment: 1 } },
    select: { saleCounter: true, posPrefix: true },
  });
  return `${store.posPrefix}-RET-${String(store.saleCounter).padStart(6, "0")}`;
}

/**
 * Validates each returned line against the sale item's original quantity
 * minus whatever has already been returned against it (so the same item
 * can't be over-returned across multiple partial-return requests), then
 * records a RETURN_IN stock movement per line via the existing
 * recordStockMovement.
 */
export async function createReturn(tx: TransactionClient, input: CreateReturnInput) {
  const saleItems = await tx.saleItem.findMany({
    where: { saleId: input.originalSaleId, id: { in: input.items.map((item) => item.saleItemId) } },
    include: { returnItems: true },
  });
  const saleItemById = new Map(saleItems.map((saleItem) => [saleItem.id, saleItem]));

  let totalRefunded = 0;
  const itemsData = input.items.map((item) => {
    const saleItem = saleItemById.get(item.saleItemId);
    if (!saleItem) throw new InvalidReferenceError("saleItemId");

    const alreadyReturned = saleItem.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    const remaining = saleItem.quantity - alreadyReturned;
    if (item.quantity <= 0 || item.quantity > remaining) {
      throw new InvalidReturnQuantityError(
        `Cannot return ${item.quantity} of "${saleItem.productName}" — only ${remaining} remaining from this sale.`,
      );
    }

    // Refund proportionally from the line's actual (post-discount, incl.
    // TVA) total rather than recomputing from unitPrice/tvaRate, so a
    // discounted line refunds the discounted amount, not the list price.
    const perUnitRefund = Math.round(saleItem.total / saleItem.quantity);
    const refundAmount = perUnitRefund * item.quantity;
    totalRefunded += refundAmount;

    return {
      saleItemId: saleItem.id,
      productId: saleItem.productId,
      quantity: item.quantity,
      unitPrice: saleItem.unitPrice,
      tvaRate: saleItem.tvaRate,
      refundAmount,
      reason: item.reason ?? null,
    };
  });

  const returnNumber = await nextReturnNumber(tx, input.storeId);

  const saleReturn = await tx.saleReturn.create({
    data: {
      storeId: input.storeId,
      originalSaleId: input.originalSaleId,
      returnNumber,
      reason: input.reason ?? null,
      totalRefunded,
      createdBy: input.createdBy,
      items: { create: itemsData },
    },
    include: { items: true },
  });

  for (const item of itemsData) {
    await recordStockMovement(tx, {
      productId: item.productId,
      storeId: input.storeId,
      movementType: "RETURN_IN",
      quantity: item.quantity,
      referenceId: saleReturn.id,
      referenceType: "sale_return",
      createdBy: input.createdBy,
    });
  }

  return saleReturn;
}
