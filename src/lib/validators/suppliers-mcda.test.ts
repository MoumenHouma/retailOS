import { describe, it, expect } from "vitest";
import { RunSupplierEvaluationSchema } from "./suppliers-mcda";

const pairwiseMatrix = [
  [1, 3, 5, 7, 2, 4],
  [1 / 3, 1, 3, 5, 1 / 2, 2],
  [1 / 5, 1 / 3, 1, 3, 1 / 4, 1 / 2],
  [1 / 7, 1 / 5, 1 / 3, 1, 1 / 6, 1 / 4],
  [1 / 2, 2, 4, 6, 1, 3],
  [1 / 4, 1 / 2, 2, 4, 1 / 3, 1],
];

describe("RunSupplierEvaluationSchema", () => {
  it("requires at least 2 supplierIds to rank", () => {
    const result = RunSupplierEvaluationSchema.safeParse({
      supplierIds: ["11111111-1111-1111-1111-111111111111"],
      method: "topsis_only",
      evaluationPeriod: "2026-Q1",
    });
    expect(result.success).toBe(false);
  });

  it("requires a pairwiseMatrix for ahp_* methods", () => {
    const result = RunSupplierEvaluationSchema.safeParse({
      supplierIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
      ],
      method: "ahp_topsis",
      evaluationPeriod: "2026-Q1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["pairwiseMatrix"]);
    }
  });

  it("accepts an ahp_* method when a pairwiseMatrix is given", () => {
    const result = RunSupplierEvaluationSchema.safeParse({
      supplierIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
      ],
      method: "ahp_promethee",
      pairwiseMatrix,
      evaluationPeriod: "2026-Q1",
    });
    expect(result.success).toBe(true);
  });

  it("does not require a pairwiseMatrix for topsis_only", () => {
    const result = RunSupplierEvaluationSchema.safeParse({
      supplierIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
      ],
      method: "topsis_only",
      weights: { price: 0.5, quality: 0.5 },
      evaluationPeriod: "2026-Q1",
    });
    expect(result.success).toBe(true);
  });
});
