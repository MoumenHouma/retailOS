import { z } from "zod";

export const RecordInvoicePaymentSchema = z.object({
  amount: z.number().int().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "CHECK", "TRANSFER", "MIXED"]),
  reference: z.string().max(100).nullable().optional(),
  paidAt: z.coerce.date().default(() => new Date()),
});
export type RecordInvoicePaymentInput = z.infer<typeof RecordInvoicePaymentSchema>;
