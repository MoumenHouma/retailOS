import { z } from "zod";

export const CreateCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  nameAr: z.string().max(255).nullable().optional(),
  nameEn: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

export const CreateBrandSchema = z.object({
  name: z.string().min(1).max(255),
  country: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;

export const UpdateBrandSchema = CreateBrandSchema.partial();
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;

export const CreateUnitSchema = z.object({
  name: z.string().min(1).max(50),
  abbreviation: z.string().min(1).max(10),
  isBaseUnit: z.boolean().default(false),
});
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;

export const UpdateUnitSchema = CreateUnitSchema.partial();
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;

export const CreateProductSchema = z.object({
  sku: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(500),
  nameAr: z.string().max(500).nullable().optional(),
  nameEn: z.string().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid(),
  barcode: z.string().max(20).nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  sellingPrice: z.number().int().min(0),
  wholesalePrice: z.number().int().min(0).nullable().optional(),
  minPrice: z.number().int().min(0).nullable().optional(),
  tvaRate: z.union([z.literal(0), z.literal(9), z.literal(19)]).default(19),
  isTaxable: z.boolean().default(true),
  isTrackable: z.boolean().default(true),
  isExpirable: z.boolean().default(false),
  shelfLifeDays: z.number().int().min(0).nullable().optional(),
  minStockLevel: z.number().int().min(0).default(0),
  maxStockLevel: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const ProductSearchQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.enum(["name", "createdAt", "sellingPrice"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ProductSearchQuery = z.infer<typeof ProductSearchQuerySchema>;

export const AddBarcodeSchema = z.object({
  barcode: z.string().min(1).max(20),
  barcodeType: z.enum(["EAN13", "CODE128", "QR", "INTERNAL"]).default("EAN13"),
  isPrimary: z.boolean().default(false),
});
export type AddBarcodeInput = z.infer<typeof AddBarcodeSchema>;

export const BulkProductActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["activate", "deactivate", "set_category"]),
  categoryId: z.string().uuid().nullable().optional(),
});
export type BulkProductActionInput = z.infer<typeof BulkProductActionSchema>;

// Import rows use human-readable names instead of UUIDs — resolved to ids
// (auto-creating category/brand if missing) during commit.
export const ProductImportRowSchema = z.object({
  name: z.string().min(1).max(500),
  nameAr: z.string().max(500).nullable().optional(),
  nameEn: z.string().max(500).nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  barcode: z.string().max(20).nullable().optional(),
  categoryName: z.string().max(255).nullable().optional(),
  brandName: z.string().max(255).nullable().optional(),
  unitAbbreviation: z.string().max(10),
  costPrice: z.number().int().min(0).nullable().optional(),
  sellingPrice: z.number().int().min(0),
  wholesalePrice: z.number().int().min(0).nullable().optional(),
  minPrice: z.number().int().min(0).nullable().optional(),
  tvaRate: z.union([z.literal(0), z.literal(9), z.literal(19)]).default(19),
  minStockLevel: z.number().int().min(0).default(0),
  maxStockLevel: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
});
export type ProductImportRow = z.infer<typeof ProductImportRowSchema>;

export const ImportCommitSchema = z.object({
  rows: z.array(ProductImportRowSchema),
  skipErrors: z.boolean().default(true),
});
export type ImportCommitInput = z.infer<typeof ImportCommitSchema>;
