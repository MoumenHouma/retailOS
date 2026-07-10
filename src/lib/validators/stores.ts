import { z } from "zod";

export const StoreCreateSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  wilaya: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});
export type StoreCreate = z.infer<typeof StoreCreateSchema>;

export const StoreUpdateSchema = StoreCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type StoreUpdate = z.infer<typeof StoreUpdateSchema>;

export const UserStoreAssignSchema = z.object({
  userId: z.string().uuid(),
  storeId: z.string().uuid(),
});
export type UserStoreAssign = z.infer<typeof UserStoreAssignSchema>;
