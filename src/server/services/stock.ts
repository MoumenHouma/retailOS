import type { Prisma, StockMovementType } from "@prisma/client";
import { revalidateTag } from "next/cache";

type TransactionClient = Prisma.TransactionClient;

/**
 * Call from a route handler after its withTenant transaction commits, on
 * every path that ends up calling recordStockMovement (sales, adjustments,
 * transfers, stock counts, purchase deliveries, returns). Invalidates
 * getReorderSuggestionsCached's tag for this tenant. Deliberately not
 * called from inside recordStockMovement itself: that runs pre-commit
 * (would invalidate on a rollback) and has no tenantId in scope.
 */
export function invalidateStockCache(tenantId: string) {
  // Next 16 requires a second "profile" arg on revalidateTag ("max" = the
  // old single-arg immediate-revalidate behavior; omitting it still works
  // at runtime but only with a deprecation warning, and fails `tsc`/`next
  // build`'s type check).
  revalidateTag(`stock:${tenantId}`, "max");
}

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
  // product_batches exists as of Phase 3 Chunk B — only PURCHASE_IN lines
  // that carry a batch (expirationDate given at receiving time) populate it.
  batchId?: string | null;
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

/**
 * Bulk sibling of recordStockMovement for completeSale's per-line-item loop
 * (was up to N sequential creates, one per sale line). `fn_apply_stock_movement`
 * is a per-row AFTER INSERT trigger, so createMany still fires it once per
 * inserted row and still rolls back the whole multi-row INSERT (and, since
 * this runs inside the caller's withTenant transaction, the whole sale) the
 * same way a single oversold `create` would.
 */
export async function recordStockMovements(tx: TransactionClient, inputs: RecordStockMovementInput[]) {
  if (inputs.length === 0) return;
  try {
    await tx.stockMovement.createMany({ data: inputs });
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

  // isLowStock compares two columns (quantityOnHand vs. product.minStockLevel),
  // which Prisma can't express in `where` without raw SQL. Filtering it in JS
  // means pagination has to happen in JS too — fetch every matching row
  // (fine at Phase 1 catalog sizes) rather than paginating pre-filter, which
  // would silently drop/misreport low-stock rows outside the current page.
  const rows = await tx.stockLevel.findMany({
    where,
    include: { product: { select: { name: true, barcode: true, minStockLevel: true } }, store: true },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = rows
    .map((row) => ({ ...row, isLowStock: row.quantityOnHand <= row.product.minStockLevel }))
    .filter((row) => (lowStockOnly ? row.isLowStock : true));

  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

interface GetProductBatchesQuery {
  productId?: string;
  storeId?: string;
  expiringOnly?: boolean;
  page: number;
  pageSize: number;
}

/**
 * Read-only batch/expiry browser for the Inventory page's Batches tab
 * (PHASE3_PURCHASING_PLAN.md Chunk B: "least disruptive way to expose it
 * ... without turning this into an Inventory-page redesign"). expiringOnly
 * narrows to batches that still have stock remaining and carry an
 * expiration date, soonest first.
 */
export async function getProductBatches(tx: TransactionClient, query: GetProductBatchesQuery) {
  const { productId, storeId, expiringOnly, page, pageSize } = query;

  const where: Prisma.ProductBatchWhereInput = {
    deletedAt: null,
    ...(productId ? { productId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(expiringOnly ? { quantityRemaining: { gt: 0 }, expirationDate: { not: null } } : {}),
  };

  const [items, total] = await Promise.all([
    tx.productBatch.findMany({
      where,
      include: { product: { select: { name: true } }, store: { select: { name: true } } },
      orderBy: [{ expirationDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.productBatch.count({ where }),
  ]);

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
