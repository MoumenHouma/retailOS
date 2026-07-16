import { describe, it, expect } from "vitest";
import { EmployeePerformanceQuerySchema } from "./employee-performance";

describe("EmployeePerformanceQuerySchema", () => {
  it("bumps a date-only 'to' value to the last instant of that UTC day", () => {
    const result = EmployeePerformanceQuerySchema.parse({ from: "2026-04-01", to: "2026-04-30" });
    expect(result.to.toISOString()).toBe("2026-04-30T23:59:59.999Z");
  });

  it("leaves storeId optional", () => {
    const result = EmployeePerformanceQuerySchema.safeParse({ from: "2026-04-01", to: "2026-04-30" });
    expect(result.success).toBe(true);
  });

  it("requires from and to", () => {
    const result = EmployeePerformanceQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
