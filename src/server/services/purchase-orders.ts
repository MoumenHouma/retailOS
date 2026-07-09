import type { Prisma } from "@prisma/client";
import { InvalidReferenceError } from "./products";
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderItemInput,
  PurchaseOrderListQuery,
  UpdatePurchaseOrderInput,
} from "@/lib/validators/purchasing";

type TransactionClient = Prisma.TransactionClient;

export class InvalidPoStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPoStatusTransitionError";
  }
}

export class MissingUnitPriceError extends Error {
  constructor(productId: string) {
    super(
      `No unit price given for product ${productId}, and this supplier has no SupplierProduct price on file for it.`,
    );
    this.name = "MissingUnitPriceError";
  }
}

/**
 * Same "FK checks can bypass RLS" concern as products.ts's local
 * assertBelongsToTenant, kept as its own copy here rather than exporting
 * and broadening that one — this service only ever needs to check
 * supplierId/storeId, not the product/category/brand/unit set it handles.
 */
async function assertExists(
  tx: TransactionClient,
  model: "supplier" | "store",
  id: string,
): Promise<void> {
  const found = await (tx[model] as { findUnique: (args: unknown) => Promise<unknown> }).findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) {
    throw new InvalidReferenceError(model);
  }
}

/**
 * Prices each line from the supplier's SupplierProduct.unitPrice when the
 * caller doesn't supply one — a PO's unit price is the negotiated cost with
 * that specific supplier, never derived from Product.sellingPrice the way
 * sale line items derive from it. tvaRate always comes from the Product
 * record, same rule sales/invoices already follow.
 */
async function priceOrderItems(
  tx: TransactionClient,
  supplierId: string,
  items: PurchaseOrderItemInput[],
) {
  const productIds = items.map((item) => item.productId);
  const [products, supplierProducts] = await Promise.all([
    tx.product.findMany({ where: { id: { in: productIds } } }),
    tx.supplierProduct.findMany({ where: { supplierId, productId: { in: productIds } } }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const supplierProductByProduct = new Map(supplierProducts.map((sp) => [sp.productId, sp]));

  let subtotal = 0;
  let tvaAmount = 0;

  const itemsData = items.map((item) => {
    const product = productById.get(item.productId);
    if (!product) throw new InvalidReferenceError("productId");

    const unitPrice = item.unitPrice ?? supplierProductByProduct.get(item.productId)?.unitPrice;
    if (unitPrice == null) throw new MissingUnitPriceError(item.productId);

    const lineSubtotal = unitPrice * item.quantityOrdered;
    const lineTva = Math.round((lineSubtotal * product.tvaRate) / 100);
    subtotal += lineSubtotal;
    tvaAmount += lineTva;

    return {
      productId: product.id,
      quantityOrdered: item.quantityOrdered,
      unitPrice,
      tvaRate: product.tvaRate,
      subtotal: lineSubtotal,
      tvaAmount: lineTva,
      total: lineSubtotal + lineTva,
    };
  });

  return { itemsData, subtotal, tvaAmount, total: subtotal + tvaAmount };
}

/**
 * Gapless per-store PO numbering — identical shape to sales.ts's
 * nextSaleNumber (the UPDATE's row lock serializes concurrent creators on
 * the same store). purchase_orders.store_id is NOT NULL, so this simpler
 * per-store counter fits better than an InvoiceSequence-style dedicated
 * table (that pattern exists specifically for tenant-wide, year-aware
 * numbering, neither of which applies to a PO).
 */
async function nextPoNumber(tx: TransactionClient, storeId: string): Promise<string> {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { poCounter: { increment: 1 } },
    select: { poCounter: true },
  });
  return `PO-${String(store.poCounter).padStart(6, "0")}`;
}

export async function createPurchaseOrder(
  tx: TransactionClient,
  input: CreatePurchaseOrderInput,
  userId: string,
) {
  await assertExists(tx, "supplier", input.supplierId);
  await assertExists(tx, "store", input.storeId);

  const { itemsData, subtotal, tvaAmount, total } = await priceOrderItems(
    tx,
    input.supplierId,
    input.items,
  );
  const poNumber = await nextPoNumber(tx, input.storeId);

  return tx.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: input.supplierId,
      storeId: input.storeId,
      expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
      notes: input.notes ?? null,
      subtotal,
      tvaAmount,
      total,
      createdBy: userId,
      items: { create: itemsData },
    },
    include: { items: true, supplier: true, store: true },
  });
}

async function getEditablePoOrThrow(tx: TransactionClient, id: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "draft" && po.status !== "pending_approval") {
    throw new InvalidPoStatusTransitionError("Only draft or pending-approval purchase orders can be edited.");
  }
  return po;
}

export async function updatePurchaseOrder(
  tx: TransactionClient,
  id: string,
  input: UpdatePurchaseOrderInput,
) {
  const po = await getEditablePoOrThrow(tx, id);

  const data: Prisma.PurchaseOrderUpdateInput = {};
  if (input.expectedDeliveryDate !== undefined) {
    data.expectedDeliveryDate = input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  if (input.items) {
    const { itemsData, subtotal, tvaAmount, total } = await priceOrderItems(tx, po.supplierId, input.items);
    await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
    data.subtotal = subtotal;
    data.tvaAmount = tvaAmount;
    data.total = total;
    data.items = { create: itemsData };
  }

  return tx.purchaseOrder.update({ where: { id }, data, include: { items: true } });
}

export async function submitForApproval(tx: TransactionClient, id: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "draft") {
    throw new InvalidPoStatusTransitionError("Only draft purchase orders can be submitted for approval.");
  }
  return tx.purchaseOrder.update({ where: { id }, data: { status: "pending_approval" } });
}

export async function approvePurchaseOrder(tx: TransactionClient, id: string, approverId: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "pending_approval") {
    throw new InvalidPoStatusTransitionError("Only pending-approval purchase orders can be approved.");
  }
  return tx.purchaseOrder.update({ where: { id }, data: { status: "approved", approvedBy: approverId } });
}

export async function markOrdered(tx: TransactionClient, id: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "approved") {
    throw new InvalidPoStatusTransitionError("Only approved purchase orders can be marked as ordered.");
  }
  return tx.purchaseOrder.update({ where: { id }, data: { status: "ordered", orderedAt: new Date() } });
}

export async function cancelPurchaseOrder(tx: TransactionClient, id: string) {
  const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status === "received" || po.status === "cancelled") {
    throw new InvalidPoStatusTransitionError("This purchase order can no longer be cancelled.");
  }
  return tx.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
}

export async function searchPurchaseOrders(tx: TransactionClient, query: PurchaseOrderListQuery) {
  const { status, supplierId, storeId, q, page, pageSize } = query;

  const where: Prisma.PurchaseOrderWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(q ? { poNumber: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await Promise.all([
    tx.purchaseOrder.findMany({
      where,
      include: { supplier: true, store: true, items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.purchaseOrder.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPurchaseOrderById(tx: TransactionClient, id: string) {
  return tx.purchaseOrder.findUniqueOrThrow({
    where: { id },
    include: { supplier: true, store: true, items: { include: { product: true } } },
  });
}
