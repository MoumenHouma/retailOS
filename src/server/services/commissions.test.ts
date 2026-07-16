import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { calculateCommissionsForPeriod } from "./commissions";

function makeTx({
  rules = [] as any[],
  sales = [] as any[],
  employees = [] as any[],
  existingCommission = null as any,
}) {
  return {
    commissionRule: { findMany: vi.fn().mockResolvedValue(rules) },
    sale: { findMany: vi.fn().mockResolvedValue(sales) },
    employee: { findMany: vi.fn().mockResolvedValue(employees) },
    saleCommission: {
      findFirst: vi.fn().mockResolvedValue(existingCommission),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

const from = new Date("2026-01-01");
const to = new Date("2026-01-31");

describe("calculateCommissionsForPeriod — rate computation", () => {
  it("computes a percentage commission as a rounded share of the sale subtotal", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "percentage", rateValue: 5 }],
      sales: [{ id: "s1", cashierId: "u1", subtotal: 10_000 }],
      employees: [{ id: "e1", userId: "u1" }],
    });

    await calculateCommissionsForPeriod(tx, { from, to });

    expect((tx as any).saleCommission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ employeeId: "e1", saleId: "s1", ruleId: "r1", baseAmount: 10_000, amount: 500 }),
    });
  });

  it("rounds a percentage commission rather than truncating", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "percentage", rateValue: 5 }],
      // 10_333 * 5 / 100 = 516.65 -> rounds to 517, not 516
      sales: [{ id: "s1", cashierId: "u1", subtotal: 10_333 }],
      employees: [{ id: "e1", userId: "u1" }],
    });

    await calculateCommissionsForPeriod(tx, { from, to });

    expect((tx as any).saleCommission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 517 }),
    });
  });

  it("uses a fixed commission amount regardless of the sale subtotal", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "fixed", rateValue: 300 }],
      sales: [{ id: "s1", cashierId: "u1", subtotal: 999_999 }],
      employees: [{ id: "e1", userId: "u1" }],
    });

    await calculateCommissionsForPeriod(tx, { from, to });

    expect((tx as any).saleCommission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 300 }),
    });
  });
});

describe("calculateCommissionsForPeriod — scope filtering", () => {
  it("applies a global rule to every cashier's sales", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "fixed", rateValue: 100 }],
      sales: [
        { id: "s1", cashierId: "u1", subtotal: 1_000 },
        { id: "s2", cashierId: "u2", subtotal: 1_000 },
      ],
      employees: [
        { id: "e1", userId: "u1" },
        { id: "e2", userId: "u2" },
      ],
    });

    const result = await calculateCommissionsForPeriod(tx, { from, to });

    expect(result.created).toBe(2);
    expect((tx as any).saleCommission.create).toHaveBeenCalledTimes(2);
  });

  it("applies an employee-scoped rule only to that employee's own sales", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "employee", targetEmployeeId: "e1", rateType: "fixed", rateValue: 100 }],
      sales: [
        { id: "s1", cashierId: "u1", subtotal: 1_000 }, // e1 — matches
        { id: "s2", cashierId: "u2", subtotal: 1_000 }, // e2 — does not match
      ],
      employees: [
        { id: "e1", userId: "u1" },
        { id: "e2", userId: "u2" },
      ],
    });

    const result = await calculateCommissionsForPeriod(tx, { from, to });

    expect(result.created).toBe(1);
    expect((tx as any).saleCommission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ saleId: "s1", employeeId: "e1" }),
    });
  });

  it("skips a sale whose cashier has no linked Employee record", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "fixed", rateValue: 100 }],
      sales: [{ id: "s1", cashierId: "orphan-user", subtotal: 1_000 }],
      employees: [{ id: "e1", userId: "u1" }],
    });

    const result = await calculateCommissionsForPeriod(tx, { from, to });

    expect(result.created).toBe(0);
    expect(result.salesScanned).toBe(1);
  });
});

describe("calculateCommissionsForPeriod — idempotent recomputation", () => {
  it("updates an existing (sale, rule) commission instead of creating a duplicate", async () => {
    const tx = makeTx({
      rules: [{ id: "r1", isActive: true, scope: "global", targetEmployeeId: null, rateType: "fixed", rateValue: 100 }],
      sales: [{ id: "s1", cashierId: "u1", subtotal: 1_000 }],
      employees: [{ id: "e1", userId: "u1" }],
      existingCommission: { id: "existing-1" },
    });

    const result = await calculateCommissionsForPeriod(tx, { from, to });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect((tx as any).saleCommission.create).not.toHaveBeenCalled();
    expect((tx as any).saleCommission.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.objectContaining({ baseAmount: 1_000, amount: 100 }),
    });
  });
});
