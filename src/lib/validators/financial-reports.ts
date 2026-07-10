import { z } from "zod";

// Every caller of these schemas sends `to` as a date-only string from an
// <input type="date">, coerced by z.coerce.date() to that day's exact UTC
// midnight — which then silently excluded everything dated *later that same
// day* from a `lte: to` Prisma filter (confirmed live during Phase 4 Chunk
// C verification: same-day sales/payments were dropped from cash-flow/tax-
// report/expense-analysis totals). Bumping to the last instant of that UTC
// calendar day makes "to" inclusive of the whole day, matching what every
// date-range picker in this app actually means.
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export const RevenueDashboardQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
  granularity: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});
export type RevenueDashboardQuery = z.infer<typeof RevenueDashboardQuerySchema>;

export const FinancialReportQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
});
export type FinancialReportQuery = z.infer<typeof FinancialReportQuerySchema>;
