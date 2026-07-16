import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { recordStockMovement, recordStockMovements, adjustStock, InsufficientStockError } from "./stock";

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    stockMovement: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    ...overrides,
  } as unknown as Prisma.TransactionClient;
}

const baseInput = {
  productId: "p1",
  storeId: "s1",
  movementType: "SALE_OUT" as const,
  quantity: 5,
  createdBy: "u1",
};

describe("recordStockMovement", () => {
  it("passes the input straight through to stockMovement.create", async () => {
    const tx = makeTx();
    (tx as any).stockMovement.create.mockResolvedValue({ id: "m1" });

    await recordStockMovement(tx, baseInput);

    expect((tx as any).stockMovement.create).toHaveBeenCalledWith({ data: baseInput });
  });

  it("translates the DB trigger's negative-stock exception into InsufficientStockError", async () => {
    const tx = makeTx();
    (tx as any).stockMovement.create.mockRejectedValue(
      new Error("would result in negative on-hand quantity for product p1"),
    );

    await expect(recordStockMovement(tx, baseInput)).rejects.toThrow(InsufficientStockError);
  });

  it("re-throws any other database error unchanged", async () => {
    const tx = makeTx();
    const dbError = new Error("connection reset");
    (tx as any).stockMovement.create.mockRejectedValue(dbError);

    await expect(recordStockMovement(tx, baseInput)).rejects.toBe(dbError);
  });
});

describe("recordStockMovements", () => {
  it("is a no-op for an empty batch — never touches the database", async () => {
    const tx = makeTx();
    await recordStockMovements(tx, []);
    expect((tx as any).stockMovement.createMany).not.toHaveBeenCalled();
  });

  it("creates every row in one batch and maps the trigger error the same way as the single-row path", async () => {
    const tx = makeTx();
    (tx as any).stockMovement.createMany.mockRejectedValue(
      new Error("negative on-hand quantity"),
    );

    await expect(recordStockMovements(tx, [baseInput, { ...baseInput, productId: "p2" }])).rejects.toThrow(
      InsufficientStockError,
    );
    expect((tx as any).stockMovement.createMany).toHaveBeenCalledWith({
      data: [baseInput, { ...baseInput, productId: "p2" }],
    });
  });
});

describe("adjustStock", () => {
  it("rejects a zero or negative quantity", async () => {
    const tx = makeTx();
    await expect(
      adjustStock(tx, { productId: "p1", storeId: "s1", direction: "IN", quantity: 0, reason: "recount", userId: "u1" }),
    ).rejects.toThrow(/greater than 0/);
    await expect(
      adjustStock(tx, { productId: "p1", storeId: "s1", direction: "IN", quantity: -1, reason: "recount", userId: "u1" }),
    ).rejects.toThrow(/greater than 0/);
  });

  it("rejects a blank or whitespace-only reason", async () => {
    const tx = makeTx();
    await expect(
      adjustStock(tx, { productId: "p1", storeId: "s1", direction: "IN", quantity: 3, reason: "   ", userId: "u1" }),
    ).rejects.toThrow(/reason is required/);
  });

  it("maps IN to ADJUSTMENT_IN and OUT to ADJUSTMENT_OUT", async () => {
    const tx = makeTx();
    (tx as any).stockMovement.create.mockResolvedValue({ id: "m1" });

    await adjustStock(tx, { productId: "p1", storeId: "s1", direction: "IN", quantity: 3, reason: "recount", userId: "u1" });
    expect((tx as any).stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ movementType: "ADJUSTMENT_IN", notes: "recount" }),
    });

    await adjustStock(tx, { productId: "p1", storeId: "s1", direction: "OUT", quantity: 2, reason: "damage", userId: "u1" });
    expect((tx as any).stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ movementType: "ADJUSTMENT_OUT", notes: "damage" }),
    });
  });
});
