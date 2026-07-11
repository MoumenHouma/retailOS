import { Prisma } from "@prisma/client";
import { recordStockMovements } from "./stock";
import { InvalidReferenceError } from "./products";
import { SessionClosedError } from "./pos-sessions";
import { getEffectivePrices } from "./customer-pricing";
import { computeEarnedPoints, earnPoints } from "./loyalty";

type TransactionClient = Prisma.TransactionClient;

export class EmptySaleError extends Error {
  constructor() {
    super("A sale must have at least one item.");
    this.name = "EmptySaleError";
  }
}

export class PaymentMismatchError extends Error {
  constructor(expected: number, received: number) {
    super(`Payment total (${received}) does not cover the sale total (${expected}).`);
    this.name = "PaymentMismatchError";
  }
}

export class SaleNotHeldError extends Error {
  constructor() {
    super("This sale is not a held ticket.");
    this.name = "SaleNotHeldError";
  }
}

interface SaleItemInput {
  productId: string;
  quantity: number;
  discountAmount?: number;
}

interface CompleteSalePaymentInput {
  paymentMethod: "CASH" | "CARD" | "CHECK" | "TRANSFER";
  amount: number;
  reference?: string | null;
}

interface CompleteSaleInput {
  storeId: string;
  posSessionId: string;
  customerId?: string | null;
  items: SaleItemInput[];
  payments: CompleteSalePaymentInput[];
  discountAmount?: number;
  notes?: string | null;
  cashierId: string;
  isOffline?: boolean;
}

interface HoldSaleInput {
  storeId: string;
  posSessionId: string;
  customerId?: string | null;
  items: SaleItemInput[];
  discountAmount?: number;
  notes?: string | null;
  cashierId: string;
}

/**
 * Sale numbers are gapless per store: the UPDATE's row lock serializes
 * concurrent cashiers on the same store for the lifetime of this
 * transaction (see Store.saleCounter in schema.prisma).
 */
async function nextSaleNumber(tx: TransactionClient, storeId: string): Promise<string> {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { saleCounter: { increment: 1 } },
    select: { saleCounter: true, posPrefix: true },
  });
  return `${store.posPrefix}-${String(store.saleCounter).padStart(6, "0")}`;
}

/**
 * Resolves unit price/TVA/cost from the Product record server-side — a
 * client can request a discount (subject to the pos:discount permission at
 * the route level) but can never supply its own price, closing off a
 * tampered-request underselling path. Shared by completeSale and holdSale
 * so a held ticket's totals are priced identically to a live one.
 *
 * Phase 4 Chunk B touch: when customerId is present, an active
 * CustomerPrice override for that customer+product wins over
 * Product.sellingPrice — one additional lookup branch, not a rewrite (same
 * "small additive touch" precedent Phase 3 Chunk B used for
 * recordStockMovement).
 */
async function priceItems(tx: TransactionClient, items: SaleItemInput[], customerId?: string | null) {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const customerPrices = customerId
    ? await getEffectivePrices(tx, customerId, items.map((item) => item.productId))
    : new Map<string, number>();

  let subtotal = 0;
  let tvaAmount = 0;
  let lineDiscountTotal = 0;

  const itemsData = items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new InvalidReferenceError("productId");

    const unitPrice = customerPrices.get(item.productId) ?? product.sellingPrice;
    const discount = item.discountAmount ?? 0;
    const lineSubtotal = unitPrice * item.quantity - discount;
    const lineTva = Math.round((lineSubtotal * product.tvaRate) / 100);

    subtotal += unitPrice * item.quantity;
    lineDiscountTotal += discount;
    tvaAmount += lineTva;

    return {
      productId: product.id,
      productName: product.name,
      productBarcode: product.barcode,
      quantity: item.quantity,
      unitPrice,
      costPrice: product.costPrice,
      tvaRate: product.tvaRate,
      discountAmount: discount,
      subtotal: lineSubtotal,
      tvaAmount: lineTva,
      total: lineSubtotal + lineTva,
    };
  });

  return { itemsData, subtotal, tvaAmount, lineDiscountTotal, productById };
}

/**
 * Phase 5 Chunk B touch: FEFO (first-expired-first-out) batch consumption,
 * scoped to isExpirable products only — non-expirable products keep today's
 * behavior untouched, minimizing blast radius on this hot path. Without
 * this, ProductBatch.quantityRemaining never shrinks (see its own schema
 * comment, a gap deliberately deferred since Phase 3 Chunk B), which makes
 * Phase 5 Chunk B's expiration-risk prediction meaningless — it needs to
 * know how much of an expiring batch is actually still on the shelf.
 * Greedily consumes across batches (oldest expirationDate first) until the
 * sold quantity is covered; returns the first batch touched, for
 * SaleItem.batchId (a single nullable FK can't represent a split across
 * batches, so only the primary one is recorded — good enough for
 * traceability, and StockMovement rows exist per-line regardless).
 */
async function consumeExpirableBatch(
  tx: TransactionClient,
  { productId, storeId, quantity }: { productId: string; storeId: string; quantity: number },
): Promise<string | null> {
  const batches = await tx.productBatch.findMany({
    where: { productId, storeId, quantityRemaining: { gt: 0 }, deletedAt: null },
    orderBy: [{ expirationDate: "asc" }],
  });

  let remaining = quantity;
  let primaryBatchId: string | null = null;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const consume = Math.min(batch.quantityRemaining, remaining);
    if (consume <= 0) continue;
    await tx.productBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: consume } },
    });
    primaryBatchId ??= batch.id;
    remaining -= consume;
  }
  return primaryBatchId;
}

/**
 * The only entry point for creating a completed Sale. One withTenant
 * transaction: Sale + SaleItem[] + SalePayment[], then one batched SALE_OUT
 * stock movement per line via recordStockMovements (the same "only path
 * that writes stock_movements" used by inventory adjustments, just its bulk
 * sibling) — so an oversold line still rolls the whole sale back, same as
 * every other stock movement.
 */
export async function completeSale(tx: TransactionClient, input: CompleteSaleInput) {
  if (input.items.length === 0) {
    throw new EmptySaleError();
  }

  const session = await tx.posSession.findUnique({ where: { id: input.posSessionId } });
  if (!session || session.status !== "open") {
    throw new SessionClosedError();
  }

  const { itemsData, subtotal, tvaAmount, lineDiscountTotal, productById } = await priceItems(
    tx,
    input.items,
    input.customerId,
  );

  // Ticket-level discount is applied post-tax (flat off the total), matching
  // DATABASE.md's sales.discount_amount column — it doesn't re-derive TVA.
  // Chunk C's invoice generator computes its own DÉCRET 05-468 TVA
  // breakdown from the sale's line items, independent of this receipt total.
  const ticketDiscount = input.discountAmount ?? 0;
  const discountAmount = lineDiscountTotal + ticketDiscount;
  const total = subtotal - discountAmount + tvaAmount;

  const totalPaid = input.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (totalPaid < total) {
    throw new PaymentMismatchError(total, totalPaid);
  }
  const changeDue = totalPaid - total;

  const saleNumber = await nextSaleNumber(tx, input.storeId);

  const sale = await tx.sale.create({
    data: {
      storeId: input.storeId,
      saleNumber,
      posSessionId: input.posSessionId,
      customerId: input.customerId ?? null,
      cashierId: input.cashierId,
      subtotal,
      discountAmount,
      tvaAmount,
      total,
      totalPaid,
      changeDue,
      notes: input.notes ?? null,
      isOffline: input.isOffline ?? false,
      syncedAt: input.isOffline ? new Date() : null,
      items: { create: itemsData },
      payments: {
        create: input.payments.map((payment) => ({
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
          reference: payment.reference ?? null,
        })),
      },
    },
    include: { items: true, payments: true },
  });

  // consumeExpirableBatch's own findMany+update loop is left as sequential
  // per-line-item awaits deliberately — it's the FEFO allocation logic
  // itself (which batch, in which order, gets how much), and batch count
  // per product/store is naturally small (not a "load everything" scale
  // problem). What *was* a real N-round-trips-per-line cost is batched
  // below instead: one raw UPDATE for every line's batchId assignment (was
  // up to N sequential `saleItem.update`s) and one `createMany` for every
  // line's stock movement (was up to N sequential `recordStockMovement`
  // creates) — collected here, applied once after the loop.
  const stockMovements: Parameters<typeof recordStockMovements>[1] = [];
  const batchAssignments: { saleItemId: string; batchId: string }[] = [];

  for (const [i, item] of itemsData.entries()) {
    const product = productById.get(item.productId);
    const saleItem = sale.items[i];

    let batchId: string | null = null;
    if (product?.isExpirable) {
      batchId = await consumeExpirableBatch(tx, {
        productId: item.productId,
        storeId: input.storeId,
        quantity: item.quantity,
      });
      if (batchId && saleItem) {
        batchAssignments.push({ saleItemId: saleItem.id, batchId });
      }
    }

    stockMovements.push({
      productId: item.productId,
      storeId: input.storeId,
      movementType: "SALE_OUT",
      quantity: item.quantity,
      referenceId: sale.id,
      referenceType: "sale",
      createdBy: input.cashierId,
      batchId,
    });
  }

  if (batchAssignments.length > 0) {
    await tx.$executeRaw`
      UPDATE sale_items AS si
      SET batch_id = v.batch_id::uuid
      FROM (VALUES ${Prisma.join(
        batchAssignments.map((a) => Prisma.sql`(${a.saleItemId}::uuid, ${a.batchId}::uuid)`),
      )}) AS v(id, batch_id)
      WHERE si.id = v.id
    `;
  }

  await recordStockMovements(tx, stockMovements);

  // Phase 4 Chunk B touch: customer-side bookkeeping on a completed sale —
  // aggregate stats (DATABASE.md §10.1's totalPurchases/totalSpent/
  // visitCount/lastVisitAt columns would otherwise sit permanently at 0)
  // plus loyalty-point earning. Both are additive, post-creation writes;
  // neither can block or roll back the sale itself.
  if (input.customerId) {
    await tx.customer.update({
      where: { id: input.customerId },
      data: {
        totalPurchases: { increment: 1 },
        totalSpent: { increment: sale.total },
        visitCount: { increment: 1 },
        lastVisitAt: new Date(),
      },
    });
    const earnedPoints = computeEarnedPoints(sale.total);
    if (earnedPoints > 0) {
      await earnPoints(tx, { customerId: input.customerId, saleId: sale.id, points: earnedPoints });
    }
  }

  return sale;
}

/**
 * "Held" tickets (F3 in the POS keyboard shortcuts) are a real Sale row
 * with status="held" and priced line items, but no payments and no stock
 * movement — a hold never touches inventory. Recalling it (see recallSale
 * below) discards the row again; a hold is a parking slot for the cart, not
 * a durable partial-sale record.
 */
export async function holdSale(tx: TransactionClient, input: HoldSaleInput) {
  if (input.items.length === 0) {
    throw new EmptySaleError();
  }

  const session = await tx.posSession.findUnique({ where: { id: input.posSessionId } });
  if (!session || session.status !== "open") {
    throw new SessionClosedError();
  }

  const { itemsData, subtotal, tvaAmount, lineDiscountTotal } = await priceItems(
    tx,
    input.items,
    input.customerId,
  );
  const discountAmount = lineDiscountTotal + (input.discountAmount ?? 0);
  const total = subtotal - discountAmount + tvaAmount;

  const saleNumber = await nextSaleNumber(tx, input.storeId);

  return tx.sale.create({
    data: {
      storeId: input.storeId,
      saleNumber,
      posSessionId: input.posSessionId,
      customerId: input.customerId ?? null,
      cashierId: input.cashierId,
      subtotal,
      discountAmount,
      tvaAmount,
      total,
      totalPaid: 0,
      changeDue: 0,
      status: "held",
      notes: input.notes ?? null,
      items: { create: itemsData },
    },
    include: { items: true },
  });
}

export async function listHeldSales(tx: TransactionClient, storeId: string) {
  return tx.sale.findMany({
    where: { storeId, status: "held", deletedAt: null },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns the held ticket's items so the client can reload them into the
 * working cart, then soft-deletes the held row — recalling "consumes" the
 * hold. The eventual checkout is a brand-new completeSale() call, not an
 * update of this row (see the class doc comment on holdSale).
 */
export async function recallSale(tx: TransactionClient, saleId: string) {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale || sale.status !== "held") {
    throw new SaleNotHeldError();
  }
  await tx.sale.update({ where: { id: sale.id }, data: { deletedAt: new Date() } });
  return sale;
}

interface SaleHistoryQuery {
  storeId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export async function searchSales(tx: TransactionClient, query: SaleHistoryQuery) {
  const { storeId, q, page, pageSize } = query;

  const where: Prisma.SaleWhereInput = {
    deletedAt: null,
    status: "completed",
    ...(storeId ? { storeId } : {}),
    ...(q ? { saleNumber: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    tx.sale.findMany({
      where,
      include: { items: true, payments: true, customer: true, invoices: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.sale.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSaleById(tx: TransactionClient, id: string) {
  return tx.sale.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { returnItems: true } }, payments: true, customer: true, returns: true },
  });
}
