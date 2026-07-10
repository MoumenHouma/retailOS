import { z } from "zod";

// Same same-day-inclusive fix as financial-reports.ts's endOfUtcDay — every
// date-range picker sends `to` as a date-only string that z.coerce.date()
// parses to that day's UTC midnight; bump to the day's last instant so
// `lte: to` doesn't silently drop same-day rows.
function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export const SalesReportQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date().transform(endOfUtcDay),
  granularity: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});
export type SalesReportQuery = z.infer<typeof SalesReportQuerySchema>;

export const InventoryReportQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
});
export type InventoryReportQuery = z.infer<typeof InventoryReportQuerySchema>;

export const ScheduledReportCreateSchema = z.object({
  reportType: z.enum(["sales", "inventory", "purchase", "financial", "employee"]),
  name: z.string().min(1).max(200),
  filters: z.record(z.string(), z.unknown()).default({}),
  format: z.enum(["pdf", "xlsx", "csv"]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipientEmails: z.array(z.string().email()).min(1),
  isActive: z.boolean().default(true),
});
export type ScheduledReportCreate = z.infer<typeof ScheduledReportCreateSchema>;

export const ScheduledReportUpdateSchema = ScheduledReportCreateSchema.partial();
export type ScheduledReportUpdate = z.infer<typeof ScheduledReportUpdateSchema>;

export const DashboardLayoutUpdateSchema = z.object({
  widgets: z.array(z.object({ key: z.string(), enabled: z.boolean() })),
});
export type DashboardLayoutUpdate = z.infer<typeof DashboardLayoutUpdateSchema>;
