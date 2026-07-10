import { z } from "zod";

export const RedeemLoyaltyPointsSchema = z.object({
  points: z.number().int().min(1),
  reason: z.string().max(100).optional(),
});
export type RedeemLoyaltyPointsInput = z.infer<typeof RedeemLoyaltyPointsSchema>;
