import { describe, it, expect } from "vitest";
import { RevenueDashboardQuerySchema, FinancialReportQuerySchema } from "./financial-reports";

describe("RevenueDashboardQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    const result = RevenueDashboardQuerySchema.parse({ from: "2026-02-01", to: "2026-02-28" });
    expect(result.to.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("defaults granularity to daily", () => {
    const result = RevenueDashboardQuerySchema.parse({ from: "2026-02-01", to: "2026-02-28" });
    expect(result.granularity).toBe("daily");
  });
});

describe("FinancialReportQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    const result = FinancialReportQuerySchema.parse({ from: "2026-02-01", to: "2026-02-28" });
    expect(result.to.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("handles a leap-day 'to' boundary correctly", () => {
    const result = FinancialReportQuerySchema.parse({ from: "2028-02-01", to: "2028-02-29" });
    expect(result.to.toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });

  it("requires both from and to", () => {
    const result = FinancialReportQuerySchema.safeParse({ from: "2026-02-01" });
    expect(result.success).toBe(false);
  });
});
