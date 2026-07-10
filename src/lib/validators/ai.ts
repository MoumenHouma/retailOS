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
