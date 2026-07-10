import { z } from "zod";

const EvaluationMethodSchema = z.enum(["ahp_topsis", "ahp_promethee", "ahp_only", "topsis_only"]);

export const RunSupplierEvaluationSchema = z
  .object({
    supplierIds: z.array(z.string().uuid()).min(2, "At least 2 suppliers are needed to rank."),
    method: EvaluationMethodSchema,
    // 6x6 Saaty-scale pairwise comparison matrix, required for ahp_* methods.
    pairwiseMatrix: z.array(z.array(z.number().positive())).optional(),
    // Direct weights (0-1, summing to ~1), required for topsis_only.
    weights: z
      .object({
        price: z.number().min(0).max(1),
        quality: z.number().min(0).max(1),
        delivery: z.number().min(0).max(1),
        reliability: z.number().min(0).max(1),
        paymentTerms: z.number().min(0).max(1),
        productRange: z.number().min(0).max(1),
      })
      .partial()
      .optional(),
    evaluationPeriod: z.string().min(1).max(50),
  })
  .refine((data) => data.method === "topsis_only" || !!data.pairwiseMatrix, {
    message: "pairwiseMatrix is required for ahp_* methods.",
    path: ["pairwiseMatrix"],
  });
export type RunSupplierEvaluationInput = z.infer<typeof RunSupplierEvaluationSchema>;

export const ListSupplierEvaluationsQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
});
