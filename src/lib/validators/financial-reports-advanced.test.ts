import { describe, it, expect } from "vitest";
import { TaxReportQuerySchema, MarginAnalysisQuerySchema } from "./financial-reports-advanced";

describe("TaxReportQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    const result = TaxReportQuerySchema.parse({ from: "2026-01-01", to: "2026-03-31" });
    expect(result.to.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("defaults bucket to monthly", () => {
    const result = TaxReportQuerySchema.parse({ from: "2026-01-01", to: "2026-03-31" });
    expect(result.bucket).toBe("monthly");
  });

  it("accepts an explicit quarterly bucket", () => {
    const result = TaxReportQuerySchema.parse({ from: "2026-01-01", to: "2026-03-31", bucket: "quarterly" });
    expect(result.bucket).toBe("quarterly");
  });
});

describe("MarginAnalysisQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    const result = MarginAnalysisQuerySchema.parse({ from: "2026-01-01", to: "2026-01-31" });
    expect(result.to.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });

  it("defaults groupBy to product", () => {
    const result = MarginAnalysisQuerySchema.parse({ from: "2026-01-01", to: "2026-01-31" });
    expect(result.groupBy).toBe("product");
  });

  it("rejects an unknown groupBy", () => {
    const result = MarginAnalysisQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-01-31",
      groupBy: "warehouse",
    });
    expect(result.success).toBe(false);
  });
});
