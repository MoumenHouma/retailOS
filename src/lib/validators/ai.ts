import { z } from "zod";

export const TriggerForecastSchema = z.object({
  productId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  horizonDays: z.coerce.number().int().min(1).max(365).default(30),
});
export type TriggerForecastInput = z.infer<typeof TriggerForecastSchema>;

export const ListForecastsQuerySchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid(),
});
export type ListForecastsQuery = z.infer<typeof ListForecastsQuerySchema>;

export const RecomputeOptimizationSchema = z.object({
  storeId: z.string().uuid(),
});

export const GenerateRecommendationsSchema = z.object({
  storeId: z.string().uuid().optional(),
});

const RecommendationTypeSchema = z.enum([
  "reorder",
  "supplier_switch",
  "price_change",
  "markdown",
  "promotion",
  "staffing",
  "waste_prevention",
]);

export const ListRecommendationsQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  recommendationType: RecommendationTypeSchema.optional(),
  isRead: z.coerce.boolean().optional(),
  isActioned: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const UpdateRecommendationSchema = z.object({
  isRead: z.boolean().optional(),
  isActioned: z.boolean().optional(),
});

export const SimulateScenarioSchema = z.object({
  storeId: z.string().uuid().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  priceChangePct: z.number().min(-100).max(1000).optional(),
  demandChangePct: z.number().min(-100).max(1000).optional(),
  costChangePct: z.number().min(-100).max(1000).optional(),
});
