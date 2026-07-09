import { z } from "zod";

// unitPrice is optional — omitted lines are priced from that supplier's
// SupplierProduct.unitPrice at service time. tvaRate is never client
// supplied, it's always resolved from the Product record (same rule sales
// line items follow).
export const PurchaseOrderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantityOrdered: z.number().int().positive(),
  unitPrice: z.number().int().min(0).nullable().optional(),
});
export type PurchaseOrderItemInput = z.infer<typeof PurchaseOrderItemInputSchema>;

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  storeId: z.string().uuid(),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(PurchaseOrderItemInputSchema).min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

export const UpdatePurchaseOrderSchema = z.object({
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(PurchaseOrderItemInputSchema).min(1).optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;

const PO_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
] as const;

export const PurchaseOrderListQuerySchema = z.object({
  status: z.enum(PO_STATUSES).optional(),
  supplierId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PurchaseOrderListQuery = z.infer<typeof PurchaseOrderListQuerySchema>;

export const SupplierQuoteItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().min(0),
});
export type SupplierQuoteItemInput = z.infer<typeof SupplierQuoteItemInputSchema>;

export const CreateSupplierQuoteSchema = z.object({
  supplierId: z.string().uuid(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(SupplierQuoteItemInputSchema).min(1),
});
export type CreateSupplierQuoteInput = z.infer<typeof CreateSupplierQuoteSchema>;

export const QuoteCompareQuerySchema = z.object({
  productIds: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1)),
});
export type QuoteCompareQuery = z.infer<typeof QuoteCompareQuerySchema>;

// --- Phase 3 Chunk B: Delivery & Receiving -------------------------------

// batchNumber/expirationDate/unitCost are all optional per line — a
// delivery line only becomes a ProductBatch when expirationDate is given
// (see receiveDelivery's batch-creation rule).
export const ReceiveDeliveryItemInputSchema = z.object({
  poItemId: z.string().uuid(),
  quantityDelivered: z.number().int().positive(),
  batchNumber: z.string().max(100).nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  unitCost: z.number().int().min(0).nullable().optional(),
});
export type ReceiveDeliveryItemInput = z.infer<typeof ReceiveDeliveryItemInputSchema>;

export const ReceiveDeliverySchema = z.object({
  deliveredAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(ReceiveDeliveryItemInputSchema).min(1),
});
export type ReceiveDeliveryInput = z.infer<typeof ReceiveDeliverySchema>;

export const CreatePurchaseReturnItemInputSchema = z.object({
  deliveryItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().nullable().optional(),
});
export type CreatePurchaseReturnItemInput = z.infer<typeof CreatePurchaseReturnItemInputSchema>;

export const CreatePurchaseReturnSchema = z.object({
  originalDeliveryId: z.string().uuid(),
  reason: z.string().nullable().optional(),
  items: z.array(CreatePurchaseReturnItemInputSchema).min(1),
});
export type CreatePurchaseReturnInput = z.infer<typeof CreatePurchaseReturnSchema>;
