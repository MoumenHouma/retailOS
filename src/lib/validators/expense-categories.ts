import { z } from "zod";

export const CreateExpenseCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategorySchema>;

export const UpdateExpenseCategorySchema = CreateExpenseCategorySchema.partial();
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategorySchema>;
