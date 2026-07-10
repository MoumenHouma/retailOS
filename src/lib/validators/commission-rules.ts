import { z } from "zod";

export const CreateCommissionRuleSchema = z.object({
  name: z.string().min(1).max(100),
  scope: z.enum(["global", "employee"]).default("global"),
  targetEmployeeId: z.string().uuid().nullable().optional(),
  rateType: z.enum(["percentage", "fixed"]),
  rateValue: z.number().int().min(0),
});
export type CreateCommissionRuleInput = z.infer<typeof CreateCommissionRuleSchema>;

export const UpdateCommissionRuleSchema = CreateCommissionRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCommissionRuleInput = z.infer<typeof UpdateCommissionRuleSchema>;
