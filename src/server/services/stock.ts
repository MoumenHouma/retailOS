import type { Prisma, StockMovementType } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

interface RecordStockMovementInput {
  productId: string;
  storeId: string;
  movementType: StockMovementType;
  quantity: number;
  notes?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  createdBy: string;
}

/**
 * The only function permitted to write to stock_movements. A database
 * trigger (fn_apply_stock_movement) maintains stock_levels and raises an
 * exception — rolling back this insert too — if the resulting on-hand
 * quantity would go negative.
 */
export async function recordStockMovement(tx: TransactionClient, input: RecordStockMovementInput) {
  try {
    return await tx.stockMovement.create({ data: input });
  } catch (error) {
    const message = (error as { message?: string })?.message ?? "";
    if (message.includes("negative on-hand quantity")) {
      throw new InsufficientStockError(
        "This movement would result in negative stock — not enough on-hand quantity.",
      );
    }
    throw error;
  }
}

interface AdjustStockInput {
  productId: string;
  storeId: string;
  direction: "IN" | "OUT";
  quantity: number;
  reason: string;
  userId: string;
}

/**
 * Phase 1's only reachable stock-movement path. Requires a non-empty reason
 * — a reason-less adjustment is exactly the CRUD-only shortcut MASTER_PROMPT
 * says to avoid; every stock change must be attributable.
 */
export async function adjustStock(tx: TransactionClient, input: AdjustStockInput) {
  if (input.quantity <= 0) {
    throw new Error("quantity must be greater than 0");
  }
  if (!input.reason.trim()) {
    throw new Error("reason is required for a stock adjustment");
  }

  return recordStockMovement(tx, {
    productId: input.productId,
    storeId: input.storeId,
    movementType: input.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
    quantity: input.quantity,
    notes: input.reason,
    createdBy: input.userId,
  });
}

interface GetStockLevelsQuery {
  productId?: string;
  storeId?: string;
  lowStockOnly?: boolean;
  page: number;
  pageSize: number;
}

export async function getStockLevels(tx: TransactionClient, query: GetStockLevelsQuery) {
  const { productId, storeId, lowStockOnly, page, pageSize } = query;

  const where: Prisma.StockLevelWhereInput = {
    ...(productId ? { productId } : {}),
    ...(storeId ? { storeId } : {}),
  };

  const [rows, total] = await Promise.all([
    tx.stockLevel.findMany({
      where,
      include: { product: { select: { name: true, barcode: true, minStockLevel: true } }, store: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.stockLevel.count({ where }),
  ]);

  const items = rows
    .map((row) => ({ ...row, isLowStock: row.quantityOnHand <= row.product.minStockLevel }))
    .filter((row) => (lowStockOnly ? row.isLowStock : true));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

interface GetStockMovementHistoryQuery {
  productId?: string;
  storeId?: string;
  movementType?: StockMovementType;
  page: number;
  pageSize: number;
}

export async function getStockMovementHistory(
  tx: TransactionClient,
  query: GetStockMovementHistoryQuery,
) {
  const { productId, storeId, movementType, page, pageSize } = query;

  const where: Prisma.StockMovementWhereInput = {
    ...(productId ? { productId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(movementType ? { movementType } : {}),
  };

  const [items, total] = await Promise.all([
    tx.stockMovement.findMany({
      where,
      include: { product: { select: { name: true } }, store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.stockMovement.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
