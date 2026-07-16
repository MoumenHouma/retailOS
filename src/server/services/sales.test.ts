import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  completeSale,
  holdSale,
  EmptySaleError,
  PaymentMismatchError,
} from "./sales";
import { SessionClosedError } from "./pos-sessions";

const productA = {
  id: "prod-a",
  name: "Product A",
  barcode: "1111",
  sellingPrice: 1_000,
  costPrice: 600,
  tvaRate: 19,
  isExpirable: false,
};
const productB = {
  id: "prod-b",
  name: "Product B",
  barcode: "2222",
  sellingPrice: 500,
  costPrice: 200,
  tvaRate: 0,
  isExpirable: false,
};

function makeTx({
  session = { status: "open" } as any,
  products = [productA, productB],
  saleCreateResult = null as any,
  customerPrices = [] as any[],
}) {
  const items = products.map((p) => ({ id: `si-${p.id}` }));
  return {
    posSession: { findUnique: vi.fn().mockResolvedValue(session) },
    product: { findMany: vi.fn().mockResolvedValue(products) },
    customerPrice: { findMany: vi.fn().mockResolvedValue(customerPrices) },
    store: { update: vi.fn().mockResolvedValue({ saleCounter: 7, posPrefix: "POS" }) },
    sale: {
      create: vi.fn().mockResolvedValue(
        saleCreateResult ?? { id: "sale-1", items, payments: [], total: 0 },
      ),
    },
    stockMovement: { createMany: vi.fn().mockResolvedValue({ count: products.length }) },
    customer: { update: vi.fn() },
    loyaltyPointTransaction: { create: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe("completeSale — guards", () => {
  it("rejects an empty sale before touching the database", async () => {
    const tx = makeTx({});
    await expect(
      completeSale(tx, {
        storeId: "store-1",
        posSessionId: "sess-1",
        items: [],
        payments: [],
        cashierId: "cashier-1",
      }),
    ).rejects.toThrow(EmptySaleError);
    expect((tx as any).posSession.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a sale against a session that isn't open", async () => {
    const tx = makeTx({ session: { status: "closed" } });
    await expect(
      completeSale(tx, {
        storeId: "store-1",
        posSessionId: "sess-1",
        items: [{ productId: "prod-a", quantity: 1 }],
        payments: [{ paymentMethod: "CASH", amount: 10_000 }],
        cashierId: "cashier-1",
      }),
    ).rejects.toThrow(SessionClosedError);
  });

  it("rejects a sale against a session that doesn't exist", async () => {
    const tx = makeTx({ session: null });
    await expect(
      completeSale(tx, {
        storeId: "store-1",
        posSessionId: "sess-1",
        items: [{ productId: "prod-a", quantity: 1 }],
        payments: [{ paymentMethod: "CASH", amount: 10_000 }],
        cashierId: "cashier-1",
      }),
    ).rejects.toThrow(SessionClosedError);
  });

  it("rejects underpayment with the shortfall reflected in the error", async () => {
    const tx = makeTx({});
    await expect(
      completeSale(tx, {
        storeId: "store-1",
        posSessionId: "sess-1",
        items: [{ productId: "prod-a", quantity: 1 }],
        payments: [{ paymentMethod: "CASH", amount: 1 }],
        cashierId: "cashier-1",
      }),
    ).rejects.toThrow(PaymentMismatchError);
  });
});

describe("completeSale — totals and stock", () => {
  it("computes subtotal/discount/tva/total from server-side prices, not any client-supplied price", async () => {
    const tx = makeTx({ saleCreateResult: { id: "sale-1", items: [{ id: "si-a" }, { id: "si-b" }], total: 3_730 } });

    await completeSale(tx, {
      storeId: "store-1",
      posSessionId: "sess-1",
      items: [
        { productId: "prod-a", quantity: 2 }, // 1000 * 2 = 2000 @ 19% TVA -> 380
        { productId: "prod-b", quantity: 3, discountAmount: 100 }, // 500*3-100=1400 @ 0% TVA -> 0
      ],
      payments: [{ paymentMethod: "CASH", amount: 4_000 }],
      discountAmount: 50, // ticket-level discount
      cashierId: "cashier-1",
    });

    // subtotal accumulates unit price * quantity, before any discount:
    // 2000 + 1500 = 3500. Line discounts (100) + ticket discount (50) = 150.
    // tva = 380 (from product A only). total = 3500 - 150 + 380 = 3730.
    expect((tx as any).sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          saleNumber: "POS-000007",
          subtotal: 3_500,
          discountAmount: 150,
          tvaAmount: 380,
          total: 3_730,
          totalPaid: 4_000,
          changeDue: 270,
        }),
      }),
    );
  });

  it("records one SALE_OUT stock movement per line, referencing the created sale", async () => {
    const tx = makeTx({ saleCreateResult: { id: "sale-42", items: [{ id: "si-a" }, { id: "si-b" }], total: 100 } });

    await completeSale(tx, {
      storeId: "store-1",
      posSessionId: "sess-1",
      items: [
        { productId: "prod-a", quantity: 2 },
        { productId: "prod-b", quantity: 3 },
      ],
      payments: [{ paymentMethod: "CASH", amount: 1_000_000 }],
      cashierId: "cashier-1",
    });

    expect((tx as any).stockMovement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ productId: "prod-a", quantity: 2, movementType: "SALE_OUT", referenceId: "sale-42" }),
        expect.objectContaining({ productId: "prod-b", quantity: 3, movementType: "SALE_OUT", referenceId: "sale-42" }),
      ],
    });
  });

  it("updates customer stats and earns loyalty points when the sale is attached to a customer", async () => {
    const tx = makeTx({ saleCreateResult: { id: "sale-1", items: [{ id: "si-a" }], total: 1_190 } });
    (tx as any).customer.update.mockResolvedValue({ loyaltyPoints: 1 });

    await completeSale(tx, {
      storeId: "store-1",
      posSessionId: "sess-1",
      customerId: "cust-1",
      items: [{ productId: "prod-a", quantity: 1 }],
      payments: [{ paymentMethod: "CASH", amount: 2_000 }],
      cashierId: "cashier-1",
    });

    expect((tx as any).customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cust-1" },
        data: expect.objectContaining({
          totalPurchases: { increment: 1 },
          totalSpent: { increment: 1_190 },
          visitCount: { increment: 1 },
        }),
      }),
    );
    // 1190 centimes * (1 point / 10,000 centimes) floors to 0 points earned —
    // too small a sale to earn anything, so no ledger row should be written.
    expect((tx as any).loyaltyPointTransaction.create).not.toHaveBeenCalled();
  });

  it("does not touch customer stats or loyalty when no customer is attached", async () => {
    const tx = makeTx({ saleCreateResult: { id: "sale-1", items: [{ id: "si-a" }], total: 1_190 } });

    await completeSale(tx, {
      storeId: "store-1",
      posSessionId: "sess-1",
      items: [{ productId: "prod-a", quantity: 1 }],
      payments: [{ paymentMethod: "CASH", amount: 2_000 }],
      cashierId: "cashier-1",
    });

    expect((tx as any).customer.update).not.toHaveBeenCalled();
  });
});

describe("holdSale", () => {
  it("rejects an empty hold the same way as an empty completed sale", async () => {
    const tx = makeTx({});
    await expect(
      holdSale(tx, { storeId: "store-1", posSessionId: "sess-1", items: [], cashierId: "cashier-1" }),
    ).rejects.toThrow(EmptySaleError);
  });

  it("creates a held sale with zero payment and never touches stock", async () => {
    const tx = makeTx({ saleCreateResult: { id: "hold-1", items: [{ id: "si-a" }] } });

    await holdSale(tx, {
      storeId: "store-1",
      posSessionId: "sess-1",
      items: [{ productId: "prod-a", quantity: 1 }],
      cashierId: "cashier-1",
    });

    expect((tx as any).sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "held", totalPaid: 0, changeDue: 0 }),
      }),
    );
    expect((tx as any).stockMovement.createMany).not.toHaveBeenCalled();
  });
});
