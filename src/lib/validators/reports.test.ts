import { describe, it, expect } from "vitest";
import { SalesReportQuerySchema, ScheduledReportCreateSchema, DashboardLayoutUpdateSchema } from "./reports";

describe("SalesReportQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    // Regression coverage: z.coerce.date() alone parses "2026-01-15" to
    // that day's exact UTC midnight, which then silently excludes every
    // same-day row from a Prisma `lte: to` filter — this repo hit that bug
    // live across several report endpoints before endOfUtcDay was added.
    const result = SalesReportQuerySchema.parse({ from: "2026-01-01", to: "2026-01-15" });
    expect(result.to.toISOString()).toBe("2026-01-15T23:59:59.999Z");
  });

  it("defaults granularity to daily", () => {
    const result = SalesReportQuerySchema.parse({ from: "2026-01-01", to: "2026-01-15" });
    expect(result.granularity).toBe("daily");
  });

  it("rejects an unknown granularity", () => {
    const result = SalesReportQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-01-15",
      granularity: "yearly",
    });
    expect(result.success).toBe(false);
  });
});

describe("ScheduledReportCreateSchema", () => {
  const base = {
    reportType: "sales" as const,
    name: "Weekly sales",
    format: "pdf" as const,
    frequency: "weekly" as const,
    recipientEmails: ["owner@example.com"],
  };

  it("accepts a well-formed schedule and defaults filters/isActive", () => {
    const result = ScheduledReportCreateSchema.parse(base);
    expect(result.filters).toEqual({});
    expect(result.isActive).toBe(true);
  });

  it("requires at least one recipient email", () => {
    const result = ScheduledReportCreateSchema.safeParse({ ...base, recipientEmails: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed recipient email", () => {
    const result = ScheduledReportCreateSchema.safeParse({ ...base, recipientEmails: ["not-an-email"] });
    expect(result.success).toBe(false);
  });
});

describe("DashboardLayoutUpdateSchema", () => {
  it("accepts a list of key/enabled widget toggles", () => {
    const result = DashboardLayoutUpdateSchema.safeParse({
      widgets: [{ key: "revenue", enabled: true }, { key: "stock-alerts", enabled: false }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a widget entry missing 'enabled'", () => {
    const result = DashboardLayoutUpdateSchema.safeParse({ widgets: [{ key: "revenue" }] });
    expect(result.success).toBe(false);
  });
});
