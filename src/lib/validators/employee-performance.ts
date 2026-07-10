import { z } from "zod";

// Same same-day-inclusive `to` bug this repo has already hit twice
// (FinancialReportQuerySchema, TaxReportQuerySchema) — bump to end-of-UTC-day
// rather than leaving `to` at that day's exact midnight.
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export const EmployeePerformanceQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
});
export type EmployeePerformanceQuery = z.infer<typeof EmployeePerformanceQuerySchema>;
