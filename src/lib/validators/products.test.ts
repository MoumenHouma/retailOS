import { describe, it, expect } from "vitest";
import { CreateProductSchema, UpdateProductSchema, BulkProductActionSchema } from "./products";

const base = {
  name: "Sample product",
  unitId: "11111111-1111-1111-1111-111111111111",
  sellingPrice: 1000,
};

describe("CreateProductSchema.tvaRate", () => {
  it("accepts Algeria's three legal TVA rates", () => {
    for (const rate of [0, 9, 19] as const) {
      expect(CreateProductSchema.safeParse({ ...base, tvaRate: rate }).success).toBe(true);
    }
  });

  it("rejects any other rate", () => {
    expect(CreateProductSchema.safeParse({ ...base, tvaRate: 20 }).success).toBe(false);
    expect(CreateProductSchema.safeParse({ ...base, tvaRate: 5 }).success).toBe(false);
  });

  it("defaults to 19 when omitted", () => {
    const result = CreateProductSchema.parse(base);
    expect(result.tvaRate).toBe(19);
  });
});

describe("CreateProductSchema required fields", () => {
  it("requires unitId and a non-negative sellingPrice", () => {
    expect(CreateProductSchema.safeParse({ name: "x", sellingPrice: 100 }).success).toBe(false);
    expect(
      CreateProductSchema.safeParse({ name: "x", unitId: base.unitId, sellingPrice: -1 }).success,
    ).toBe(false);
  });
});

describe("UpdateProductSchema", () => {
  it("allows a fully empty patch since every field is optional", () => {
    expect(UpdateProductSchema.safeParse({}).success).toBe(true);
  });

  it("still enforces the tvaRate union on a partial update", () => {
    expect(UpdateProductSchema.safeParse({ tvaRate: 20 }).success).toBe(false);
  });
});

describe("BulkProductActionSchema", () => {
  it("requires at least one product id", () => {
    expect(BulkProductActionSchema.safeParse({ ids: [], action: "activate" }).success).toBe(false);
  });

  it("accepts set_category with a categoryId", () => {
    const result = BulkProductActionSchema.safeParse({
      ids: [base.unitId],
      action: "set_category",
      categoryId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });
});
