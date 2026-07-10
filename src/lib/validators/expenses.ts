import { z } from "zod";

const PaymentMethodSchema = z.enum(["CASH", "CARD", "CHECK", "TRANSFER", "MIXED"]);

export const CreateExpenseSchema = z.object({
  storeId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  description: z.string().min(1).max(500),
  amount: z.number().int().min(0),
  tvaRate: z.union([z.literal(0), z.literal(9), z.literal(19)]).default(0),
  expenseDate: z.coerce.date(),
  paymentMethod: PaymentMethodSchema,
  reference: z.string().max(100).nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  receiptUrl: z.string().url().max(500).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const UpdateExpenseSchema = CreateExpenseSchema.partial();
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

export const ExpenseSearchQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ExpenseSearchQuery = z.infer<typeof ExpenseSearchQuerySchema>;
