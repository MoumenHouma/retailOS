import { z } from "zod";

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(500),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  nif: z.string().max(20).nullable().optional(),
  customerType: z.enum(["walk_in", "regular", "vip", "wholesale"]).default("walk_in"),
  creditLimit: z.number().int().min(0).default(0),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const CustomerSearchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerSearchQuery = z.infer<typeof CustomerSearchQuerySchema>;

export const PurchaseHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PurchaseHistoryQuery = z.infer<typeof PurchaseHistoryQuerySchema>;
