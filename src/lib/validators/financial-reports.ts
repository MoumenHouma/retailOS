import { z } from "zod";

export const RevenueDashboardQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  granularity: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});
export type RevenueDashboardQuery = z.infer<typeof RevenueDashboardQuerySchema>;

export const FinancialReportQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type FinancialReportQuery = z.infer<typeof FinancialReportQuerySchema>;
