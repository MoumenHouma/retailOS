import { z } from "zod";

export const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(255),
  nif: z.string().max(20).nullable().optional(),
  rc: z.string().max(30).nullable().optional(),
  contactPerson: z.string().max(255).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  wilaya: z.string().max(100).nullable().optional(),
  bankName: z.string().max(255).nullable().optional(),
  bankAccount: z.string().max(100).nullable().optional(),
  paymentTerms: z.number().int().min(0).default(0),
  leadTimeDays: z.number().int().min(0).default(3),
  notes: z.string().nullable().optional(),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = CreateSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

export const SupplierSearchQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.enum(["name", "createdAt"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SupplierSearchQuery = z.infer<typeof SupplierSearchQuerySchema>;

export const CreateSupplierContactSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  isPrimary: z.boolean().default(false),
});
export type CreateSupplierContactInput = z.infer<typeof CreateSupplierContactSchema>;

export const UpdateSupplierContactSchema = CreateSupplierContactSchema.partial();
export type UpdateSupplierContactInput = z.infer<typeof UpdateSupplierContactSchema>;

export const LinkSupplierProductSchema = z.object({
  productId: z.string().uuid(),
  supplierSku: z.string().max(100).nullable().optional(),
  supplierProductName: z.string().max(500).nullable().optional(),
  unitPrice: z.number().int().min(0).nullable().optional(),
  minOrderQuantity: z.number().int().min(1).default(1),
  deliveryTimeDays: z.number().int().min(0).nullable().optional(),
  isPreferred: z.boolean().default(false),
});
export type LinkSupplierProductInput = z.infer<typeof LinkSupplierProductSchema>;

export const UpdateSupplierProductSchema = LinkSupplierProductSchema.partial().omit({
  productId: true,
});
export type UpdateSupplierProductInput = z.infer<typeof UpdateSupplierProductSchema>;
