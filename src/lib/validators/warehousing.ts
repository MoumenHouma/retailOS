import { z } from "zod";

// --- Stock Transfers ------------------------------------------------------

export const StockTransferItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantityRequested: z.number().int().positive(),
});
export type StockTransferItemInput = z.infer<typeof StockTransferItemInputSchema>;

export const CreateStockTransferSchema = z.object({
  fromStoreId: z.string().uuid(),
  toStoreId: z.string().uuid(),
  notes: z.string().nullable().optional(),
  items: z.array(StockTransferItemInputSchema).min(1),
});
export type CreateStockTransferInput = z.infer<typeof CreateStockTransferSchema>;

const TRANSFER_STATUSES = ["draft", "pending", "in_transit", "received", "cancelled"] as const;

export const StockTransferListQuerySchema = z.object({
  status: z.enum(TRANSFER_STATUSES).optional(),
  storeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type StockTransferListQuery = z.infer<typeof StockTransferListQuerySchema>;

// quantity omitted on a line = send/receive the full requested/sent amount,
// same "defaults to full outstanding" convention as Chunk B's delivery
// receiving dialog.
export const SendTransferItemInputSchema = z.object({
  itemId: z.string().uuid(),
  quantitySent: z.number().int().min(0).optional(),
});
export const SendTransferSchema = z.object({
  items: z.array(SendTransferItemInputSchema).min(1),
});
export type SendTransferInput = z.infer<typeof SendTransferSchema>;

export const ReceiveTransferItemInputSchema = z.object({
  itemId: z.string().uuid(),
  quantityReceived: z.number().int().min(0).optional(),
});
export const ReceiveTransferSchema = z.object({
  items: z.array(ReceiveTransferItemInputSchema).min(1),
});
export type ReceiveTransferInput = z.infer<typeof ReceiveTransferSchema>;

// --- Stock Counts -----------------------------------------------------

export const CreateStockCountSchema = z.object({
  storeId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1),
  notes: z.string().nullable().optional(),
});
export type CreateStockCountInput = z.infer<typeof CreateStockCountSchema>;

export const UpdateCountItemSchema = z.object({
  countedQuantity: z.number().int().min(0),
});
export type UpdateCountItemInput = z.infer<typeof UpdateCountItemSchema>;

const COUNT_STATUSES = ["in_progress", "pending_review", "approved", "cancelled"] as const;

export const StockCountListQuerySchema = z.object({
  status: z.enum(COUNT_STATUSES).optional(),
  storeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type StockCountListQuery = z.infer<typeof StockCountListQuerySchema>;

// --- Warehouses / Zones / Bins ---------------------------------------------

export const CreateWarehouseSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().nullable().optional(),
});
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>;
export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>;

export const CreateWarehouseZoneSchema = z.object({
  warehouseId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(20),
});
export type CreateWarehouseZoneInput = z.infer<typeof CreateWarehouseZoneSchema>;
export const UpdateWarehouseZoneSchema = CreateWarehouseZoneSchema.partial();
export type UpdateWarehouseZoneInput = z.infer<typeof UpdateWarehouseZoneSchema>;

export const CreateWarehouseBinSchema = z.object({
  zoneId: z.string().uuid(),
  code: z.string().min(1).max(20),
  notes: z.string().nullable().optional(),
});
export type CreateWarehouseBinInput = z.infer<typeof CreateWarehouseBinSchema>;
export const UpdateWarehouseBinSchema = CreateWarehouseBinSchema.partial();
export type UpdateWarehouseBinInput = z.infer<typeof UpdateWarehouseBinSchema>;
