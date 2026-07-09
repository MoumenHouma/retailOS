import { z } from "zod";

export const OpenSessionSchema = z.object({
  storeId: z.string().uuid(),
  terminalName: z.string().min(1).max(50),
  openingCash: z.number().int().min(0),
});
export type OpenSessionInput = z.infer<typeof OpenSessionSchema>;

export const CloseSessionSchema = z.object({
  closingCash: z.number().int().min(0),
});
export type CloseSessionInput = z.infer<typeof CloseSessionSchema>;

// OPENING/CLOSING are recorded automatically by openSession/closeSession —
// this route only ever creates the mid-shift movements a cashier triggers.
export const CashMovementSchema = z.object({
  movementType: z.enum(["WITHDRAWAL", "DEPOSIT", "ADJUSTMENT"]),
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500).nullable().optional(),
});
export type CashMovementInput = z.infer<typeof CashMovementSchema>;

// Only productId/quantity/discountAmount come from the client — unitPrice,
// tvaRate and costPrice are always resolved server-side from the Product
// record so a tampered client request can't sell below cost.
export const SaleItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  discountAmount: z.number().int().min(0).default(0),
});
export type SaleItemInput = z.infer<typeof SaleItemInputSchema>;

// MIXED isn't a selectable instrument — a sale paid with more than one
// method is simply represented by more than one SalePayment row.
export const SalePaymentInputSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER"]),
  amount: z.number().int().positive(),
  reference: z.string().max(100).nullable().optional(),
});
export type SalePaymentInput = z.infer<typeof SalePaymentInputSchema>;

export const CompleteSaleSchema = z.object({
  storeId: z.string().uuid(),
  posSessionId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  items: z.array(SaleItemInputSchema).min(1),
  payments: z.array(SalePaymentInputSchema).min(1),
  discountAmount: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
  // True when this sale was rung up while the POS terminal was offline and
  // is only now (on reconnect) being pushed from the local Dexie queue.
  isOffline: z.boolean().default(false),
});
export type CompleteSaleInput = z.infer<typeof CompleteSaleSchema>;

export const SaleHistoryQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SaleHistoryQuery = z.infer<typeof SaleHistoryQuerySchema>;

export const HoldSaleSchema = z.object({
  storeId: z.string().uuid(),
  posSessionId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  items: z.array(SaleItemInputSchema).min(1),
  discountAmount: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
});
export type HoldSaleInput = z.infer<typeof HoldSaleSchema>;

export const ReturnItemInputSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().max(500).nullable().optional(),
});
export type ReturnItemInput = z.infer<typeof ReturnItemInputSchema>;

export const CreateReturnSchema = z.object({
  storeId: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
  items: z.array(ReturnItemInputSchema).min(1),
});
export type CreateReturnInput = z.infer<typeof CreateReturnSchema>;
