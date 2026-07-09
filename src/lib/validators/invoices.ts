import { z } from "zod";

export const GenerateInvoiceSchema = z.object({
  saleId: z.string().uuid(),
  paymentTerms: z.string().max(100).nullable().optional(),
});
export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const InvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;
