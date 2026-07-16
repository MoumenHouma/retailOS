import { describe, it, expect } from "vitest";
import { QuoteCompareQuerySchema, PurchaseOrderItemInputSchema } from "./purchasing";

describe("QuoteCompareQuerySchema", () => {
  it("splits a comma-separated string of UUIDs into an array", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const b = "22222222-2222-2222-2222-222222222222";
    const result = QuoteCompareQuerySchema.parse({ productIds: `${a},${b}` });
    expect(result.productIds).toEqual([a, b]);
  });

  it("accepts a single UUID with no comma", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const result = QuoteCompareQuerySchema.parse({ productIds: a });
    expect(result.productIds).toEqual([a]);
  });

  it("filters out empty segments from stray commas", () => {
    const a = "11111111-1111-1111-1111-111111111111";
    const b = "22222222-2222-2222-2222-222222222222";
    const result = QuoteCompareQuerySchema.parse({ productIds: `${a},,${b},` });
    expect(result.productIds).toEqual([a, b]);
  });

  it("rejects a non-UUID segment", () => {
    const result = QuoteCompareQuerySchema.safeParse({ productIds: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string (no ids at all)", () => {
    const result = QuoteCompareQuerySchema.safeParse({ productIds: "" });
    expect(result.success).toBe(false);
  });
});

describe("PurchaseOrderItemInputSchema", () => {
  it("allows unitPrice to be omitted (resolved server-side from the supplier catalog)", () => {
    const result = PurchaseOrderItemInputSchema.safeParse({
      productId: "11111111-1111-1111-1111-111111111111",
      quantityOrdered: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative quantityOrdered", () => {
    const base = { productId: "11111111-1111-1111-1111-111111111111" };
    expect(PurchaseOrderItemInputSchema.safeParse({ ...base, quantityOrdered: 0 }).success).toBe(false);
    expect(PurchaseOrderItemInputSchema.safeParse({ ...base, quantityOrdered: -1 }).success).toBe(false);
  });
});
