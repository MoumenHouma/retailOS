import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  computeEarnedPoints,
  computeRedemptionValue,
  earnPoints,
  redeemPoints,
  InsufficientLoyaltyPointsError,
} from "./loyalty";

describe("computeEarnedPoints", () => {
  it("earns 1 point per 100 DA (10,000 centimes) spent", () => {
    expect(computeEarnedPoints(10_000)).toBe(1);
    expect(computeEarnedPoints(1_000_000)).toBe(100);
  });

  it("floors instead of rounding up on a partial point", () => {
    expect(computeEarnedPoints(19_999)).toBe(1);
    expect(computeEarnedPoints(9_999)).toBe(0);
  });

  it("earns nothing on a zero-total sale", () => {
    expect(computeEarnedPoints(0)).toBe(0);
  });
});

describe("computeRedemptionValue", () => {
  it("values 100 points at 50 DA (5,000 centimes)", () => {
    expect(computeRedemptionValue(100)).toBe(5_000);
  });

  it("scales linearly and returns 0 for 0 points", () => {
    expect(computeRedemptionValue(1)).toBe(50);
    expect(computeRedemptionValue(0)).toBe(0);
  });
});

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    loyaltyPointTransaction: {
      create: vi.fn(),
    },
    ...overrides,
  } as unknown as Prisma.TransactionClient;
}

describe("earnPoints", () => {
  it("does nothing for zero or negative points, without touching the database", async () => {
    const tx = makeTx();
    expect(await earnPoints(tx, { customerId: "c1", saleId: "s1", points: 0 })).toBeNull();
    expect(await earnPoints(tx, { customerId: "c1", saleId: "s1", points: -5 })).toBeNull();
    expect((tx as any).customer.update).not.toHaveBeenCalled();
  });

  it("increments the customer's balance and writes a ledger row with the new balance", async () => {
    const tx = makeTx();
    (tx as any).customer.update.mockResolvedValue({ loyaltyPoints: 150 });
    (tx as any).loyaltyPointTransaction.create.mockResolvedValue({ id: "tx1" });

    await earnPoints(tx, { customerId: "c1", saleId: "s1", points: 50 });

    expect((tx as any).customer.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { loyaltyPoints: { increment: 50 } },
      select: { loyaltyPoints: true },
    });
    expect((tx as any).loyaltyPointTransaction.create).toHaveBeenCalledWith({
      data: {
        customerId: "c1",
        points: 50,
        balanceAfter: 150,
        reason: "purchase",
        referenceId: "s1",
      },
    });
  });
});

describe("redeemPoints", () => {
  it("throws InsufficientLoyaltyPointsError without writing anything when the balance is too low", async () => {
    const tx = makeTx();
    (tx as any).customer.findUniqueOrThrow.mockResolvedValue({ loyaltyPoints: 10 });

    await expect(redeemPoints(tx, { customerId: "c1", points: 20 })).rejects.toThrow(
      InsufficientLoyaltyPointsError,
    );
    expect((tx as any).customer.update).not.toHaveBeenCalled();
  });

  it("decrements the balance and records a negative ledger entry", async () => {
    const tx = makeTx();
    (tx as any).customer.findUniqueOrThrow.mockResolvedValue({ loyaltyPoints: 100 });
    (tx as any).customer.update.mockResolvedValue({ loyaltyPoints: 80 });
    (tx as any).loyaltyPointTransaction.create.mockResolvedValue({ id: "tx1" });

    await redeemPoints(tx, { customerId: "c1", points: 20 });

    expect((tx as any).customer.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { loyaltyPoints: { decrement: 20 } },
      select: { loyaltyPoints: true },
    });
    expect((tx as any).loyaltyPointTransaction.create).toHaveBeenCalledWith({
      data: {
        customerId: "c1",
        points: -20,
        balanceAfter: 80,
        reason: "redemption",
      },
    });
  });
});
