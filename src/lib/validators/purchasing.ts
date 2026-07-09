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
