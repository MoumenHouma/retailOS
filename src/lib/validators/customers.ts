import { z } from "zod";

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(500),
  phone: z.string().max(20).nullable().optional(),
  customerType: z.enum(["walk_in", "regular", "vip", "wholesale"]).default("walk_in"),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const CustomerSearchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerSearchQuery = z.infer<typeof CustomerSearchQuerySchema>;
