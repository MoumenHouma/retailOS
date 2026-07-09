import type { Prisma } from "@prisma/client";
import { recordStockMovement } from "./stock";
import { InvalidReferenceError } from "./products";
import { SessionClosedError } from "./pos-sessions";

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
 */
async function priceItems(tx: TransactionClient, items: SaleItemInput[]) {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0;
  let tvaAmount = 0;
  let lineDiscountTotal = 0;

  const itemsData = items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new InvalidReferenceError("productId");

    const discount = item.discountAmount ?? 0;
    const lineSubtotal = product.sellingPrice * item.quantity - discount;
    const lineTva = Math.round((lineSubtotal * product.tvaRate) / 100);

    subtotal += product.sellingPrice * item.quantity;
    lineDiscountTotal += discount;
    tvaAmount += lineTva;

    return {
      productId: product.id,
      productName: product.name,
      productBarcode: product.barcode,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      costPrice: product.costPrice,
      tvaRate: product.tvaRate,
      discountAmount: discount,
      subtotal: lineSubtotal,
      tvaAmount: lineTva,
      total: lineSubtotal + lineTva,
    };
  });

  return { itemsData, subtotal, tvaAmount, lineDiscountTotal };
}

/**
 * The only entry point for creating a completed Sale. One withTenant
 * transaction: Sale + SaleItem[] + SalePayment[], then a SALE_OUT stock
 * movement per line via the existing recordStockMovement (the same "only
 * path that writes stock_movements" used by inventory adjustments) — so an
 * oversold line rolls the whole sale back.
 */
export async function completeSale(tx: TransactionClient, input: CompleteSaleInput) {
  if (input.items.length === 0) {
    throw new EmptySaleError();
  }

  const session = await tx.posSession.findUnique({ where: { id: input.posSessionId } });
  if (!session || session.status !== "open") {
    throw new SessionClosedError();
  }

  const { itemsData, subtotal, tvaAmount, lineDiscountTotal } = await priceItems(tx, input.items);

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

  for (const item of itemsData) {
    await recordStockMovement(tx, {
      productId: item.productId,
      storeId: input.storeId,
      movementType: "SALE_OUT",
      quantity: item.quantity,
      referenceId: sale.id,
      referenceType: "sale",
      createdBy: input.cashierId,
    });
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

  const { itemsData, subtotal, tvaAmount, lineDiscountTotal } = await priceItems(tx, input.items);
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
