import { z } from "zod";

// Same fix as financial-reports.ts's FinancialReportQuerySchema — `to` is a
// date-only string from an <input type="date">, coerced to that day's exact
// UTC midnight; bump to the last instant of that day so `lte: to` includes
// the whole day rather than silently dropping everything dated later that
// same day (confirmed live during verification).
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export const TaxReportQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
  bucket: z.enum(["monthly", "quarterly"]).default("monthly"),
});
export type TaxReportQuery = z.infer<typeof TaxReportQuerySchema>;

export const MarginAnalysisQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
  groupBy: z.enum(["product", "category", "brand"]).default("product"),
});
export type MarginAnalysisQuery = z.infer<typeof MarginAnalysisQuerySchema>;
