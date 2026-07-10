import { z } from "zod";

export const CreateDebtSchema = z.object({
  amount: z.number().int().min(1),
  saleId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateDebtInput = z.infer<typeof CreateDebtSchema>;

export const RecordDebtPaymentSchema = z.object({
  amount: z.number().int().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER", "MIXED"]),
  reference: z.string().max(100).nullable().optional(),
  paidAt: z.coerce.date().default(() => new Date()),
});
export type RecordDebtPaymentInput = z.infer<typeof RecordDebtPaymentSchema>;
