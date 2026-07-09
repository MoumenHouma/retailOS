import { z } from "zod";

export const StockLevelsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type StockLevelsQuery = z.infer<typeof StockLevelsQuerySchema>;

const MOVEMENT_TYPES = [
  "PURCHASE_IN",
  "SALE_OUT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
  "WRITE_OFF",
] as const;

export const StockMovementHistoryQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type StockMovementHistoryQuery = z.infer<typeof StockMovementHistoryQuerySchema>;

export const ProductBatchQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  expiringOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ProductBatchQuery = z.infer<typeof ProductBatchQuerySchema>;

export const StockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().positive(),
  reason: z.string().min(1, "A reason is required for stock adjustments."),
});
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
