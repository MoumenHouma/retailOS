import { describe, it, expect } from "vitest";
import { CompleteSaleSchema, SaleItemInputSchema, SalePaymentInputSchema } from "./pos";

const storeId = "11111111-1111-1111-1111-111111111111";
const posSessionId = "22222222-2222-2222-2222-222222222222";
const productId = "33333333-3333-3333-3333-333333333333";

describe("CompleteSaleSchema", () => {
  const base = { storeId, posSessionId };

  it("rejects a sale with zero items", () => {
    const result = CompleteSaleSchema.safeParse({
      ...base,
      items: [],
      payments: [{ paymentMethod: "CASH", amount: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a sale with zero payments", () => {
    const result = CompleteSaleSchema.safeParse({
      ...base,
      items: [{ productId, quantity: 1 }],
      payments: [],
    });
    expect(result.success).toBe(false);
  });

  it("defaults discountAmount to 0 and isOffline to false", () => {
    const result = CompleteSaleSchema.parse({
      ...base,
      items: [{ productId, quantity: 1 }],
      payments: [{ paymentMethod: "CASH", amount: 100 }],
    });
    expect(result.discountAmount).toBe(0);
    expect(result.isOffline).toBe(false);
  });

  it("does not accept client-supplied unitPrice, tvaRate, or costPrice on a line item", () => {
    // These must always be resolved server-side from the Product record so
    // a tampered client request can't sell below cost — the schema simply
    // has no such fields to strip them.
    const result = CompleteSaleSchema.parse({
      ...base,
      items: [{ productId, quantity: 1, unitPrice: 1, tvaRate: 0, costPrice: 0 }],
      payments: [{ paymentMethod: "CASH", amount: 100 }],
    });
    expect(result.items[0]).not.toHaveProperty("unitPrice");
    expect(result.items[0]).not.toHaveProperty("tvaRate");
    expect(result.items[0]).not.toHaveProperty("costPrice");
  });
});

describe("SaleItemInputSchema", () => {
  it("rejects a zero or negative quantity", () => {
    expect(SaleItemInputSchema.safeParse({ productId, quantity: 0 }).success).toBe(false);
    expect(SaleItemInputSchema.safeParse({ productId, quantity: -1 }).success).toBe(false);
  });

  it("rejects a negative discountAmount", () => {
    expect(SaleItemInputSchema.safeParse({ productId, quantity: 1, discountAmount: -1 }).success).toBe(false);
  });
});

describe("SalePaymentInputSchema", () => {
  it("only accepts single-instrument payment methods, not MIXED", () => {
    const result = SalePaymentInputSchema.safeParse({ paymentMethod: "MIXED", amount: 100 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = SalePaymentInputSchema.safeParse({ paymentMethod: "CASH", amount: 0 });
    expect(result.success).toBe(false);
  });
});
